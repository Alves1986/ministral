import React, { useState, useEffect } from 'react';
import { Loader2, MessageCircle, Calendar, Clock, Trash2, Check, Send, CalendarClock, AlertTriangle, RefreshCw, CalendarDays } from 'lucide-react';
import { scheduleWhatsAppNotification, cancelWhatsAppNotification, fetchScheduledNotifications } from '../services/supabase/misc';
import { fetchRulesV2, generateOccurrencesV2, EventRuleV2, OccurrenceV2 } from '../services/scheduleServiceV2';
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

export const WhatsAppNotificationSettings: React.FC<Props> = ({ orgId, ministryId, ministries, currentUserId, onShowToast }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [rules, setRules] = useState<EventRuleV2[]>([]);
  const [occurrences, setOccurrences] = useState<OccurrenceV2[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledNotif[]>([]);

  // Weekly rule inputs: { ruleId: { daysBefore, time } }
  const [weeklyInputs, setWeeklyInputs] = useState<Record<string, { daysBefore: number; time: string }>>({});
  // Single event inputs: { ruleId_date: datetimeLocal }
  const [singleInputs, setSingleInputs] = useState<Record<string, string>>({});

  const activeMinistryId = ministryId || ministries[0]?.id;

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
    } catch (e) {
      console.error("Error loading WhatsApp schedule data:", e);
    } finally {
      setLoading(false);
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
