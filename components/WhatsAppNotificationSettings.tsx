import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, MessageCircle, Calendar, Clock, Trash2, Check, Send, CalendarClock, AlertTriangle, RefreshCw, CalendarDays, Sparkles, Edit3, RotateCcw, Save, Wand2, ChevronDown } from 'lucide-react';
import { scheduleWhatsAppNotification, cancelWhatsAppNotification, fetchScheduledNotifications } from '../services/supabase/misc';
import { fetchRulesV2, generateOccurrencesV2, EventRuleV2, OccurrenceV2 } from '../services/scheduleServiceV2';
import { fetchMinistrySettings, saveMinistrySettings } from '../services/supabase/ministries';
import { runAI, AI_TASKS } from '../services/aiOrchestrator';
import { MinistryDef } from '../types';

interface Props {
  orgId: string;
  ministryId: string | null;
  ministries: MinistryDef[];
  currentUserId?: string;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
}

interface ScheduledNotif {
  id: string;
  event_rule_id: string;
  event_date: string;
  event_title: string;
  scheduled_at: string;
  status: string;
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Templates inteligentes (espelho do backend para preview no UI)
const MINISTRY_TEMPLATE_PREVIEWS: Record<string, { icon: string; label: string; orientations: string; closing: string }> = {
  louvor:   { icon: '🎵', label: 'Louvor', orientations: '1. Chegue 30 min antes para soundcheck.\n2. Revise as músicas antes do culto.\n3. Avise a liderança em caso de imprevisto.\n4. Faça check-in no aplicativo.', closing: '🎶 Vamos adorar com tudo que somos. Ele é digno!' },
  infantil: { icon: '🌈', label: 'Infantil', orientations: '1. Chegue 20 min antes para preparar o ambiente.\n2. Confira a lição do dia com antecedência.\n3. Siga todos os protocolos de segurança das crianças.\n4. Faça check-in no aplicativo.', closing: '🌟 "Deixai os pequeninos virem a mim" — Que privilégio!' },
  midia:    { icon: '💻', label: 'Mídia', orientations: '1. Chegue 40 min antes para checklist de equipamentos.\n2. Teste câmeras, cabos e transmissão ao vivo.\n3. Tenha um plano B para falhas técnicas.\n4. Faça check-in no aplicativo.', closing: '📡 Cada clique seu leva o evangelho mais longe!' },
  recepcao: { icon: '🤝', label: 'Recepção', orientations: '1. Chegue 30 min antes — pontualidade é hospitalidade.\n2. Vista-se adequadamente (uniforme/crachá).\n3. Acolha cada pessoa como se fosse a primeira vez.\n4. Faça check-in no aplicativo.', closing: '🏠 Você não recebe pessoas — você recebe famílias!' },
  default:  { icon: '⛪', label: 'Geral', orientations: '1. Chegue 30 min antes para check-list dos equipamentos.\n2. Avise a liderança em caso de imprevisto.\n3. Faça check-in no aplicativo.', closing: '🚀 Vamos juntos servir com excelência!' },
};

function detectMinistryTemplate(code: string, label: string) {
  const c = (code || '').toLowerCase();
  const l = (label || '').toLowerCase();
  if (c.includes('louvor') || l.includes('louvor') || l.includes('música') || l.includes('musica')) return MINISTRY_TEMPLATE_PREVIEWS.louvor;
  if (c.includes('infantil') || l.includes('infantil') || l.includes('criança') || l.includes('kids')) return MINISTRY_TEMPLATE_PREVIEWS.infantil;
  if (c.includes('midia') || l.includes('mídia') || l.includes('midia') || l.includes('media') || l.includes('transmiss')) return MINISTRY_TEMPLATE_PREVIEWS.midia;
  if (c.includes('recep') || l.includes('recep') || l.includes('hospit') || l.includes('portaria')) return MINISTRY_TEMPLATE_PREVIEWS.recepcao;
  return MINISTRY_TEMPLATE_PREVIEWS.default;
}

export const WhatsAppNotificationSettings: React.FC<Props> = ({ orgId, ministryId, ministries, currentUserId, onShowToast }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [rules, setRules] = useState<EventRuleV2[]>([]);
  const [occurrences, setOccurrences] = useState<OccurrenceV2[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledNotif[]>([]);

  // Mensagem customizada
  const [customMessage, setCustomMessage] = useState('');
  const [savedCustomMessage, setSavedCustomMessage] = useState<string | undefined>(undefined);
  const [savingMsg, setSavingMsg] = useState(false);
  const [editingMsg, setEditingMsg] = useState(false);

  // Reescrita com IA
  const [aiTone, setAiTone] = useState<'motivador' | 'formal' | 'acolhedor' | 'direto'>('motivador');
  const [aiRewriting, setAiRewriting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Weekly rule inputs: { ruleId: { daysBefore, time } }
  const [weeklyInputs, setWeeklyInputs] = useState<Record<string, { daysBefore: number; time: string }>>({});
  // Single event inputs: { ruleId_date: datetimeLocal }
  const [singleInputs, setSingleInputs] = useState<Record<string, string>>({});

  const activeMinistryId = ministryId || ministries[0]?.id;
  const activeMinistry = useMemo(() => ministries.find(m => m.id === activeMinistryId), [ministries, activeMinistryId]);
  const template = useMemo(() => detectMinistryTemplate(activeMinistry?.code || '', activeMinistry?.label || ''), [activeMinistry]);

  useEffect(() => {
    if (!activeMinistryId || !orgId) return;
    loadData();
  }, [activeMinistryId, orgId]);

  const loadData = async () => {
    if (!activeMinistryId) return;
    setLoading(true);
    try {
      const fetchedRules = await fetchRulesV2(activeMinistryId, orgId);
      setRules(fetchedRules);

      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const occ1 = generateOccurrencesV2(fetchedRules, y, m);
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const occ2 = generateOccurrencesV2(fetchedRules, nextY, nextM);

      const today = new Date().toISOString().slice(0, 10);
      const futureOcc = [...occ1, ...occ2]
        .filter(e => e.date >= today)
        .sort((a, b) => a.iso.localeCompare(b.iso));
      setOccurrences(futureOcc);

      const sched = await fetchScheduledNotifications(orgId, activeMinistryId);
      setScheduled(sched);

      // Initialize weekly inputs from existing schedules
      const wInputs: Record<string, { daysBefore: number; time: string }> = {};
      const sInputs: Record<string, string> = {};

      fetchedRules.forEach(rule => {
        if (rule.type === 'weekly') {
          // Check if any occurrence has a schedule
          const ruleSchedules = sched.filter(s => s.event_rule_id === rule.id && s.status === 'pending');
          if (ruleSchedules.length > 0) {
            // Reverse-engineer daysBefore and time from the first schedule
            const first = ruleSchedules[0];
            const eventOcc = futureOcc.find(o => o.ruleId === rule.id && o.date === first.event_date);
            if (eventOcc) {
              const schedDate = new Date(first.scheduled_at);
              const evDate = new Date(eventOcc.date + 'T12:00:00');
              const diffDays = Math.round((evDate.getTime() - schedDate.getTime()) / (1000 * 60 * 60 * 24));
              const hours = String(schedDate.getHours()).padStart(2, '0');
              const mins = String(schedDate.getMinutes()).padStart(2, '0');
              wInputs[rule.id] = { daysBefore: Math.max(0, diffDays), time: `${hours}:${mins}` };
            }
          }
          if (!wInputs[rule.id]) {
            wInputs[rule.id] = { daysBefore: 1, time: '09:00' };
          }
        } else {
          // Single events
          const ruleOccs = futureOcc.filter(o => o.ruleId === rule.id);
          ruleOccs.forEach(occ => {
            const key = `${occ.ruleId}_${occ.date}`;
            const existing = sched.find(s => s.event_rule_id === occ.ruleId && s.event_date === occ.date && s.status === 'pending');
            if (existing) {
              const d = new Date(existing.scheduled_at);
              const offset = d.getTimezoneOffset() * 60000;
              sInputs[key] = new Date(d.getTime() - offset).toISOString().slice(0, 16);
            } else {
              const evDate = new Date(occ.date + 'T12:00:00');
              evDate.setDate(evDate.getDate() - 1);
              const yy = evDate.getFullYear();
              const mm = String(evDate.getMonth() + 1).padStart(2, '0');
              const dd = String(evDate.getDate()).padStart(2, '0');
              sInputs[key] = `${yy}-${mm}-${dd}T09:00`;
            }
          });
        }
      });

      setWeeklyInputs(wInputs);
      setSingleInputs(sInputs);

      // Carrega mensagem customizada salva
      const settings = await fetchMinistrySettings(activeMinistryId, orgId);
      const savedMsg = settings?.whatsappCustomMessage || '';
      setSavedCustomMessage(savedMsg || undefined);
      setCustomMessage(savedMsg);
      setEditingMsg(false);
    } catch (e) {
      console.error("Error loading WhatsApp schedule data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomMessage = async () => {
    if (!activeMinistryId) return;
    setSavingMsg(true);
    try {
      await saveMinistrySettings(
        activeMinistryId, orgId,
        undefined, undefined, undefined, undefined, // displayName, roles, start, end
        undefined, undefined, undefined, undefined, undefined, // spotify, youtube, qr, social
        undefined, // quickAccessItems
        customMessage.trim() || null // null limpa a mensagem customizada
      );
      setSavedCustomMessage(customMessage.trim() || undefined);
      setEditingMsg(false);
      onShowToast?.('Mensagem salva com sucesso!', 'success');
    } catch (e) {
      console.error(e);
      onShowToast?.('Erro ao salvar mensagem.', 'error');
    } finally {
      setSavingMsg(false);
    }
  };

  const handleAIRewrite = async () => {
    const textToRewrite = customMessage.trim() || template.orientations;
    if (!textToRewrite) {
      onShowToast?.('Digite uma mensagem antes de pedir à IA para reescrever.', 'error');
      return;
    }
    setAiRewriting(true);
    setAiError(null);
    try {
      const result = await runAI(
        AI_TASKS.WHATSAPP_MSG_REWRITE,
        { organization_name: '', ministry_name: activeMinistry?.label || 'Ministério', total_members: 0, active_members: 0, roles: [] },
        { text: textToRewrite, tone: aiTone, ministry_name: activeMinistry?.label || 'Ministério' }
      );
      // A IA retorna texto puro — pode ser string direta ou objeto
      const rewritten = typeof result === 'string' ? result : (result?.text || result?.message || JSON.stringify(result));
      setCustomMessage(rewritten.trim());
    } catch (e: any) {
      const msg = e?.message || 'Erro ao contatar a IA.';
      setAiError(msg);
      onShowToast?.(`IA: ${msg}`, 'error');
    } finally {
      setAiRewriting(false);
    }
  };

  const handleScheduleWeekly = async (rule: EventRuleV2) => {
    if (!activeMinistryId) return;
    const input = weeklyInputs[rule.id];
    if (!input) return;

    setSaving(rule.id);
    try {
      // Get all future occurrences for this rule
      const ruleOccs = occurrences.filter(o => o.ruleId === rule.id);

      for (const occ of ruleOccs) {
        // Calculate scheduled_at: X days before event at specified time
        const evDate = new Date(occ.date + 'T12:00:00');
        evDate.setDate(evDate.getDate() - input.daysBefore);
        const [hh, mm] = input.time.split(':');
        evDate.setHours(parseInt(hh), parseInt(mm), 0, 0);

        const scheduledAt = evDate.toISOString();

        await scheduleWhatsAppNotification(
          orgId,
          activeMinistryId,
          occ.ruleId,
          occ.date,
          occ.title,
          scheduledAt,
          currentUserId
        );
      }

      onShowToast?.(`${ruleOccs.length} notificações agendadas para "${rule.title}"`, "success");
      await loadData();
    } catch (e) {
      console.error(e);
      onShowToast?.("Erro ao agendar notificações", "error");
    } finally {
      setSaving(null);
    }
  };

  const handleCancelWeekly = async (rule: EventRuleV2) => {
    setSaving(`cancel_${rule.id}`);
    try {
      const ruleSchedules = scheduled.filter(s => s.event_rule_id === rule.id && s.status === 'pending');
      for (const s of ruleSchedules) {
        await cancelWhatsAppNotification(s.id);
      }
      onShowToast?.(`Agendamentos de "${rule.title}" removidos.`, "success");
      await loadData();
    } catch (e) {
      console.error(e);
      onShowToast?.("Erro ao cancelar", "error");
    } finally {
      setSaving(null);
    }
  };

  const handleScheduleSingle = async (occ: OccurrenceV2) => {
    if (!activeMinistryId) return;
    const key = `${occ.ruleId}_${occ.date}`;
    const scheduledAt = singleInputs[key];
    if (!scheduledAt) {
      onShowToast?.("Defina a data e horário do disparo.", "error");
      return;
    }

    setSaving(key);
    try {
      await scheduleWhatsAppNotification(
        orgId,
        activeMinistryId,
        occ.ruleId,
        occ.date,
        occ.title,
        new Date(scheduledAt).toISOString(),
        currentUserId
      );
      onShowToast?.(`Notificação agendada!`, "success");
      await loadData();
    } catch (e) {
      console.error(e);
      onShowToast?.("Erro ao agendar", "error");
    } finally {
      setSaving(null);
    }
  };

  const handleCancelSingle = async (id: string) => {
    setSaving(id);
    try {
      await cancelWhatsAppNotification(id);
      onShowToast?.("Agendamento removido.", "success");
      await loadData();
    } catch (e) {
      console.error(e);
      onShowToast?.("Erro ao cancelar", "error");
    } finally {
      setSaving(null);
    }
  };

  const weeklyRules = rules.filter(r => r.type === 'weekly');
  const singleRules = rules.filter(r => r.type === 'single');
  const singleOccurrences = occurrences.filter(o => singleRules.some(r => r.id === o.ruleId));

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-green-500" size={24} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-zinc-700 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-500">
          <MessageCircle size={20} />
        </div>
        <div>
          <h2 className="font-bold text-slate-800 dark:text-white">Notificações WhatsApp</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Agende lembretes automáticos para cada evento</p>
        </div>
      </div>

      <div className="p-5 space-y-6">

        {/* ── MENSAGEM PERSONALIZADA ── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          {/* Header da seção */}
          <div className="p-4 bg-gradient-to-r from-[#0f1f3d]/5 to-[#c9a84c]/10 dark:from-[#0f1f3d]/40 dark:to-[#c9a84c]/10 border-b border-zinc-100 dark:border-zinc-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#c9a84c]/20 flex items-center justify-center text-lg">
                {template.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                  Mensagem do Lembrete
                  {savedCustomMessage
                    ? <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 tracking-wider">Personalizada</span>
                    : <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#c9a84c]/20 text-[#c9a84c] tracking-wider flex items-center gap-1"><Sparkles size={8}/> Inteligente</span>
                  }
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Template detectado: {template.label}</p>
              </div>
            </div>
            {!editingMsg ? (
              <button
                onClick={() => setEditingMsg(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
              >
                <Edit3 size={12} /> Personalizar
              </button>
            ) : (
              <button
                onClick={() => { setEditingMsg(false); setCustomMessage(savedCustomMessage || ''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
              >
                <RotateCcw size={12} /> Cancelar
              </button>
            )}
          </div>

          {/* Preview do template padrão */}
          {!editingMsg && !savedCustomMessage && (
            <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/30">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Sparkles size={10}/> Preview do template automático</p>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 border border-zinc-100 dark:border-zinc-700 font-mono text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                <span className="not-italic font-sans text-zinc-400 text-[10px] block mb-1">⚠️ Orientações:</span>
                {template.orientations}
                {'\n'}<span className="text-[#c9a84c] font-sans font-bold">{template.closing}</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-2 italic">Esta mensagem é enviada automaticamente para este tipo de ministério. Clique em "Personalizar" para sobrescrever.</p>
            </div>
          )}

          {/* Mensagem customizada salva (preview) */}
          {!editingMsg && savedCustomMessage && (
            <div className="p-4">
              <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3 border border-purple-100 dark:border-purple-900/30 text-xs text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed font-mono">
                {savedCustomMessage}
              </div>
              <button
                onClick={() => { setCustomMessage(''); setSavedCustomMessage(undefined); handleSaveCustomMessage(); }}
                className="mt-2 text-[10px] text-zinc-400 hover:text-red-500 flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={10}/> Voltar ao template automático
              </button>
            </div>
          )}

          {/* Editor de mensagem customizada */}
          {editingMsg && (
            <div className="p-4 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Suas orientações personalizadas</p>
                <p className="text-[10px] text-zinc-400 mb-2">Esta mensagem substituirá as orientações padrão. A saudação e a equipe escalada são sempre incluídas automaticamente.</p>
                <textarea
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  rows={6}
                  placeholder={`Ex:\n⚠️ Orientações do ${activeMinistry?.label || 'Ministério'}:\n1. Chegue com antecedência.\n2. Lembre-se de trazer seu material.\n3. Faça check-in no aplicativo.`}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm text-zinc-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#c9a84c] font-mono resize-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600 transition-all"
                />
                <p className="text-[10px] text-zinc-400 mt-1">Deixe em branco para usar o template inteligente automático.</p>
              </div>

              {/* Barra de ferramentas IA */}
              <div className="rounded-xl border border-[#c9a84c]/30 bg-gradient-to-r from-[#c9a84c]/5 to-[#0f1f3d]/5 dark:from-[#c9a84c]/10 dark:to-[#0f1f3d]/20 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Wand2 size={13} className="text-[#c9a84c] shrink-0" />
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">Reescrever com IA</span>
                  <span className="text-[9px] text-zinc-400 ml-auto">Gemini</span>
                </div>

                {/* Seletor de tom */}
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { key: 'motivador',  label: '🔥 Motivador' },
                    { key: 'acolhedor',  label: '💛 Acolhedor' },
                    { key: 'formal',     label: '📋 Formal'    },
                    { key: 'direto',     label: '⚡ Direto'    },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setAiTone(key)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        aiTone === key
                          ? 'bg-[#c9a84c] text-white shadow-sm'
                          : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-[#c9a84c]/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleAIRewrite}
                  disabled={aiRewriting}
                  className="w-full bg-[#c9a84c] hover:bg-[#b8943e] text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60 text-xs"
                >
                  {aiRewriting
                    ? <><Loader2 size={13} className="animate-spin" /> Reescrevendo…</>
                    : <><Wand2 size={13} /> Reescrever texto com IA</>
                  }
                </button>
                {aiError && (
                  <p className="text-[10px] text-red-500 flex items-center gap-1">
                    <AlertTriangle size={10} /> {aiError}
                  </p>
                )}
                <p className="text-[9px] text-zinc-400 leading-relaxed">
                  A IA reescreve suas orientações no tom escolhido, formatado para WhatsApp. Você pode editar o resultado antes de salvar.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveCustomMessage}
                  disabled={savingMsg || aiRewriting}
                  className="flex-1 bg-[#0f1f3d] hover:bg-[#1a2d52] text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm"
                >
                  {savingMsg ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar Mensagem
                </button>
              </div>
            </div>
          )}
        </div>

        {weeklyRules.length === 0 && singleOccurrences.length === 0 && (
          <div className="text-center py-8 text-zinc-400">
            <CalendarClock size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum evento encontrado</p>
            <p className="text-xs mt-1">Configure eventos no editor de escala.</p>
          </div>
        )}

        {/* ── EVENTOS RECORRENTES ── */}
        {weeklyRules.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <RefreshCw size={12} /> Eventos Recorrentes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {weeklyRules.map(rule => {
                const input = weeklyInputs[rule.id] || { daysBefore: 1, time: '09:00' };
                const pendingCount = scheduled.filter(s => s.event_rule_id === rule.id && s.status === 'pending').length;
                const isScheduled = pendingCount > 0;
                const isSaving = saving === rule.id || saving === `cancel_${rule.id}`;
                const weekdayLabel = rule.weekday !== undefined ? WEEKDAYS[rule.weekday] : '';

                return (
                  <div key={rule.id} className={`rounded-xl border transition-all ${isScheduled ? 'border-green-200 dark:border-green-500/30 bg-green-50/30 dark:bg-green-500/5' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50'}`}>
                    {/* Card Header */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isScheduled ? 'bg-green-100 dark:bg-green-500/20 text-green-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                          <RefreshCw size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-zinc-800 dark:text-white truncate">{rule.title}</h4>
                          <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <Clock size={9} /> {weekdayLabel} • {rule.time?.substring(0, 5)}
                          </p>
                        </div>
                      </div>
                      {isScheduled && (
                        <span className="text-[9px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                          {pendingCount}x
                        </span>
                      )}
                    </div>

                    {/* Controls */}
                    <div className="px-3.5 pb-3.5">
                      {isScheduled ? (
                        <div className="flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-zinc-800 rounded-lg border border-green-100 dark:border-green-500/20">
                          <div className="flex items-center gap-1.5 text-xs min-w-0">
                            <Check size={12} className="text-green-500 shrink-0" />
                            <span className="text-zinc-500 dark:text-zinc-400 truncate">
                              {input.daysBefore === 0 ? 'No dia' : `${input.daysBefore}d antes`} às {input.time}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCancelWeekly(rule)}
                            disabled={isSaving}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                          >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={input.daysBefore}
                              onChange={e => setWeeklyInputs(prev => ({ ...prev, [rule.id]: { ...prev[rule.id], daysBefore: parseInt(e.target.value) } }))}
                              className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 text-zinc-700 dark:text-zinc-200 font-medium"
                            >
                              <option value={0}>No dia do evento</option>
                              <option value={1}>1 dia antes</option>
                              <option value={2}>2 dias antes</option>
                              <option value={3}>3 dias antes</option>
                            </select>
                            <input
                              type="time"
                              value={input.time}
                              onChange={e => setWeeklyInputs(prev => ({ ...prev, [rule.id]: { ...prev[rule.id], time: e.target.value } }))}
                              className="w-24 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 text-zinc-700 dark:text-zinc-200 font-bold"
                            />
                          </div>
                          <button
                            onClick={() => handleScheduleWeekly(rule)}
                            disabled={isSaving}
                            className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 text-xs"
                          >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={12} />}
                            Agendar Todos
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── EVENTOS ÚNICOS ── */}
        {singleOccurrences.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CalendarDays size={12} /> Eventos Únicos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {singleOccurrences.map(occ => {
                const key = `${occ.ruleId}_${occ.date}`;
                const existing = scheduled.find(s => s.event_rule_id === occ.ruleId && s.event_date === occ.date && s.status === 'pending');
                const isSaving = saving === key || saving === existing?.id;
                const [eY, eM, eD] = occ.date.split('-');

                return (
                  <div key={key} className={`rounded-xl border transition-all ${existing ? 'border-green-200 dark:border-green-500/30 bg-green-50/30 dark:bg-green-500/5' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50'}`}>
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${existing ? 'bg-green-100 dark:bg-green-500/20 text-green-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                          <Calendar size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-zinc-800 dark:text-white truncate">{occ.title}</h4>
                          <p className="text-[11px] text-zinc-400">{eD}/{eM} • {occ.time.substring(0, 5)}</p>
                        </div>
                      </div>
                      {existing && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                          <Check size={8} />
                        </span>
                      )}
                    </div>

                    <div className="px-3.5 pb-3.5">
                      {existing ? (
                        <div className="flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-zinc-800 rounded-lg border border-green-100 dark:border-green-500/20">
                          <div className="flex items-center gap-1.5 text-xs min-w-0">
                            <Send size={10} className="text-green-500 shrink-0" />
                            <span className="text-zinc-600 dark:text-zinc-300 font-medium truncate">
                              {new Date(existing.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCancelSingle(existing.id)}
                            disabled={isSaving}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                          >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-stretch gap-2">
                          <div className="flex-1 relative">
                            <input
                              type="datetime-local"
                              value={singleInputs[key] || ''}
                              onChange={e => setSingleInputs(prev => ({ ...prev, [key]: e.target.value }))}
                              className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-white rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
                            />
                          </div>
                          <button
                            onClick={() => handleScheduleSingle(occ)}
                            disabled={isSaving || !singleInputs[key]}
                            className="bg-green-500 hover:bg-green-600 text-white px-3 rounded-lg font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-50 text-xs whitespace-nowrap shrink-0"
                          >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={12} />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
