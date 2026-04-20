import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  HeartPulse, 
  MessageSquare, 
  Brain, 
  Lightbulb, 
  Users,
  RefreshCw, 
  AlertTriangle, 
  AlertOctagon,
  ChevronRight, 
  Copy, 
  Check,
  Share2,
  X,
  ChevronDown,
  AlertCircle as AlertCircleIcon
} from 'lucide-react';
import { useToast } from './Toast';
import { getSupabase } from '../services/supabaseService';
import { runAI, AI_TASKS } from '../services/aiOrchestrator';

interface Props {
  ministryId: string;
  orgId: string;
  orgName: string;
  ministryName: string;
  currentMonth: string;
  members: any[];
  availability: any;
  schedule: any;
  attendance: any;             // NOVO: confirmacoes de presenca
  swapRequests: any[];         // NOVO: historico de trocas
  events: any[];
  roles: string[];
  onScheduleGenerated: (assignments: any[]) => void;
}

export const AdvancedAIScreen: React.FC<Props> = ({
  ministryId, 
  orgId, 
  orgName,
  ministryName,
  currentMonth, 
  members, 
  availability, 
  schedule, 
  attendance, 
  swapRequests, 
  events, 
  roles, 
  onScheduleGenerated
}) => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('nvidia/nemotron-3-super-120b-a12b:free');
  const { addToast } = useToast();

  const getAIContext = () => ({
    organization_name: orgName,
    ministry_name: ministryName,
    total_members: members.length,
    active_members: members.filter(m => m.status !== 'inactive').length,
    roles: roles
  });

  // Aba ativa da tela
  const [activeTab, setActiveTab] = useState<'schedule' | 'health' | 'messages' | 'explain' | 'predictive'>('health');

  useEffect(() => {
    const saved = localStorage.getItem(`ai_model_preference_${ministryId}`);
    if (saved) setSelectedModel(saved);
  }, [ministryId]);

  // Recurso 1: Analise de saude
  const [healthInsights, setHealthInsights] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Recurso 2: Gerador de mensagens
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Recurso 3: Explicar decisao
  const [explanation, setExplanation] = useState<string>('');
  const [explainLoading, setExplainLoading] = useState(false);

  // Recurso 4: Analise Preditiva
  const [scaleSuggestions, setScaleSuggestions] = useState<string>('');
  const [preventiveAlerts, setPreventiveAlerts] = useState<string>('');
  const [predictiveLoading, setPredictiveLoading] = useState(false);

  const AI_MODELS = [
    { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Geração', description: 'Otimizado para gerar escalas estruturadas e textos longos.' },
    { id: 'openai/gpt-oss-120b:free', name: 'Lógica', description: 'Focado em decisões complexas, análise e raciocínio.' },
    { id: 'z-ai/glm-4.5-air:free', name: 'Velocidade', description: 'Resposta ultra-rápida para tarefas de escrita e avisos.' },
    { id: 'google/gemma-4-31b-it:free', name: 'Equilibrado', description: 'Modelo versátil e confiável para uso geral.' }
  ];

  useEffect(() => {
    const fetchRules = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data } = await supabase
        .from('schedule_conflict_rules')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);
      
      if (data) {
        const mappedRules = data.map((r: any) => {
          if (r.label?.startsWith('[MEMBER_BLOCK]')) {
            return {
              ...r,
              rule_type: 'block_members',
              functions: r.functions.map((f: string) => f.replace('member:', ''))
            };
          }
          if (r.label?.startsWith('[MEMBER_PREFER]')) {
            return {
              ...r,
              rule_type: 'prefer_together',
              functions: r.functions.map((f: string) => f.replace('member:', ''))
            };
          }
          return r;
        });
        setRules(mappedRules);
      }
    };
    fetchRules();
  }, [ministryId, orgId]);

  const handleSaveAIPreference = () => {
    localStorage.setItem(`ai_model_preference_${ministryId}`, selectedModel);
    setExplanation(''); // Clear explanation to force re-generation with new model
    addToast('Preferência de IA salva com sucesso!', 'success');
  };

  const handleAnalyzeHealth = async () => {
    setHealthLoading(true);
    setHealthInsights(null);
    try {
      const totalEvents = events.filter((e: any) =>
        e.iso?.startsWith(currentMonth)).length;
  
      const membersWithAvail = Object.keys(availability).filter(name =>
        (availability[name] || []).some((d: string) => d.startsWith(currentMonth)));
      const membersWithoutAvail = members
        .map((m: any) => m.name)
        .filter((n: string) => !membersWithAvail.includes(n));
  
      const scaleCount: Record<string, number> = {};
      const confirmedCount: Record<string, number> = {};
      Object.entries(schedule).forEach(([key, name]: [string, any]) => {
        if (key.includes(currentMonth.replace('-', ''))) {
          scaleCount[name] = (scaleCount[name] || 0) + 1;
          if (attendance[key]) confirmedCount[name] = (confirmedCount[name] || 0) + 1;
        }
      });
      const overloaded = Object.entries(scaleCount)
        .filter(([, count]) => (count as number) >= 3)
        .map(([name, count]) => ({ name, count }));
  
      const roleCapacity: Record<string, number> = {};
      roles.forEach((role: string) => {
        roleCapacity[role] = members.filter((m: any) =>
          (m.ministry_functions || []).includes(role)).length;
      });
      const understaffed = Object.entries(roleCapacity)
        .filter(([, count]) => (count as number) <= 1)
        .map(([role, count]) => ({ role, count }));
  
      const pendingSwaps = (swapRequests || [])
        .filter((r: any) => r.status === 'pending').length;
  
      const payload = {
        currentMonth,
        totalEvents,
        membersWithoutAvail,
        overloaded,
        understaffed,
        pendingSwaps,
        members: members.map(m => ({ name: m.name, functions: m.ministry_functions, status: m.status }))
      };
  
      const [healthParsed, memberAnalysis] = await Promise.all([
        runAI(AI_TASKS.MINISTRY_HEALTH, getAIContext(), payload),
        runAI(AI_TASKS.MEMBER_ANALYSIS, getAIContext(), payload)
      ]);

      setHealthInsights({
        ...healthParsed,
        memberAnalysis,
        membersWithoutAvail,
        overloaded,
        understaffed,
        pendingSwaps,
        totalEvents,
      });
    } catch (e: any) {
      addToast('Erro ao analisar saude do ministerio: ' + e.message, 'error');
    } finally {
      setHealthLoading(false);
    }
  };
  
  /* Removido trigger automático de análise de saúde a pedido do usuário
  useEffect(() => {
    if (members.length > 0 && events.length > 0) {
      handleAnalyzeHealth();
    }
  }, [currentMonth, ministryId]);
  */

  const handleGenerateMessages = async () => {
    if (!selectedEvent) {
      addToast('Selecione um evento primeiro.', 'error');
      return;
    }
    setMessagesLoading(true);
    setMessages([]);
    try {
      const eventDate = selectedEvent.iso?.split('T')[0];
      const selectedRuleId = selectedEvent.id?.split('|')[0];
      const escalados: { name: string; role: string }[] = [];

      Object.entries(schedule).forEach(([key, memberName]: [string, any]) => {
        if (key.includes(eventDate)) {
          const parts = key.split('|');
          const ruleId = parts[0];
          const role = parts.slice(2).join('|');

          // Filtrar apenas se pertencer ao mesmo Rule ID do evento selecionado
          if (memberName && ruleId === selectedRuleId) {
            escalados.push({ name: memberName, role });
          }
        }
      });
  
      if (escalados.length === 0) {
        addToast('Nenhum membro escalado para este evento ainda.', 'error');
        return;
      }
  
      const eventTime = selectedEvent.iso?.split('T')[1]?.slice(0, 5) || '';
      const dateFormatted = eventDate?.split('-').reverse().join('/');
  
      const payload = {
        evento: selectedEvent.title,
        data: dateFormatted,
        horario: eventTime,
        funcoes: JSON.stringify(escalados)
      };
  
      const result = await runAI(AI_TASKS.GENERATE_NOTICE, getAIContext(), payload);
      setMessages(result);
    } catch (e: any) {
      addToast('Erro ao gerar mensagens: ' + e.message, 'error');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleExplainSchedule = async () => {
    setExplainLoading(true);
    setExplanation('');
    try {
      const payload = {
        schedule,
        availability
      };
  
      const text = await runAI(AI_TASKS.EXPLAIN_DECISION, getAIContext(), payload);
      setExplanation(text);
    } catch (e: any) {
      addToast('Erro ao gerar explicacao: ' + e.message, 'error');
    } finally {
      setExplainLoading(false);
    }
  };

  const handleGetScaleSuggestions = async () => {
    setPredictiveLoading(true);
    try {
      const payload = { schedule, availability, members, events, roles };
      const text = await runAI(AI_TASKS.SCALE_SUGGESTION, getAIContext(), payload);
      setScaleSuggestions(text);
    } catch (e: any) {
      addToast('Erro ao obter sugestões: ' + e.message, 'error');
    } finally {
      setPredictiveLoading(false);
    }
  };

  const handleGetPreventiveAlerts = async () => {
    setPredictiveLoading(true);
    try {
      const payload = { schedule, availability, members, events, roles };
      const text = await runAI(AI_TASKS.PREVENTIVE_ALERT, getAIContext(), payload);
      setPreventiveAlerts(text);
    } catch (e: any) {
      addToast('Erro ao obter alertas: ' + e.message, 'error');
    } finally {
      setPredictiveLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'explain' && !explanation && !explainLoading && Object.keys(schedule).length > 0) {
      handleExplainSchedule();
    }
  }, [activeTab, schedule]);

  return (
    <div className='max-w-5xl mx-auto space-y-6 pb-10 animate-fade-in'>
  
      {/* HEADER */}
      <div className='bg-gradient-to-br from-ministral-500 to-ministral-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden'>
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
            <Sparkles size={32} className="text-ministral-100" />
            IA Avançada
          </h2>
          <p className="text-ministral-50 max-w-2xl text-sm leading-relaxed">
            Utilize nossa inteligência artificial orquestrada para gerir seu ministério.
            Análise de saúde, geração de escalas e comunicação automatizada.
          </p>
        </div>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10">
          <Sparkles size={200} />
        </div>
      </div>
  
      {/* NAVEGACAO DAS ABAS */}
      <div className='flex gap-2 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl overflow-x-auto scrollbar-hide'>
        {[
          { id: 'health',   label: 'Saúde', icon: HeartPulse },
          { id: 'predictive', label: 'Preditiva', icon: AlertTriangle },
          { id: 'messages', label: 'Avisos',        icon: MessageSquare },
          { id: 'explain',  label: 'Explicar',    icon: Brain      },
          { id: 'schedule', label: 'Configurar',       icon: Sparkles   },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5
              px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap
              ${activeTab === tab.id
                ? 'bg-white dark:bg-zinc-800 text-ministral-500 dark:text-ministral-400 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <tab.icon size={14} />{tab.label}
          </button>
        ))}
      </div>
  
      {/* ABA: SAUDE DO MINISTERIO */}
      {activeTab === 'health' && (
        <div className='bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700'>
          {healthInsights && (
            <div className='flex items-center gap-6 mb-6 p-5 bg-zinc-50 dark:bg-zinc-900 rounded-2xl'>
              <div className={`w-20 h-20 rounded-full flex flex-col items-center justify-center font-black shrink-0 border-4 ${healthInsights.score >= 80 ? 'bg-green-50 border-green-500 text-green-600' : healthInsights.score >= 60 ? 'bg-amber-50 border-amber-500 text-amber-600' : 'bg-red-50 border-red-500 text-red-600'}`}>
                <span className='text-2xl leading-none'>{healthInsights.score}</span>
                <span className='text-[9px] uppercase tracking-widest'>saúde</span>
              </div>
              <div>
                <p className='font-black text-lg text-zinc-900 dark:text-white capitalize'>{healthInsights.status}</p>
                <p className='text-sm text-zinc-500 mt-1'>{healthInsights.summary}</p>
              </div>
            </div>
          )}
  
          {healthInsights?.alerts?.length > 0 && (
            <div className='mb-4'>
              <h4 className='text-xs font-black text-red-500 uppercase tracking-wider mb-2 flex items-center gap-2'><AlertTriangle size={14}/> Alertas</h4>
              <div className='space-y-2'>
                {healthInsights.alerts.map((alert: string, i: number) => (
                  <div key={i} className='flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/40'>
                    <span className='text-red-500 mt-0.5 shrink-0'><AlertCircleIcon size={14}/></span>
                    <span className='text-sm text-red-700 dark:text-red-300'>{alert}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
  
          {healthInsights?.memberAnalysis && (
            <div className='mb-4'>
              <h4 className='text-xs font-black text-ministral-500 uppercase tracking-wider mb-2 flex items-center gap-2'><Users size={14}/> Análise de Membros</h4>
              <div className='bg-ministral-50 dark:bg-ministral-600/10 rounded-xl p-4 border border-ministral-100 dark:border-ministral-500/40'>
                <div className='text-sm text-ministral-500 dark:text-ministral-100 whitespace-pre-wrap leading-relaxed'>{healthInsights.memberAnalysis}</div>
              </div>
            </div>
          )}

          {healthInsights?.suggestions?.length > 0 && (
            <div className='mb-4'>
              <h4 className='text-xs font-black text-ministral-500 uppercase tracking-wider mb-2 flex items-center gap-2'><Lightbulb size={14}/> Sugestões da IA</h4>
              <div className='space-y-2'>
                {healthInsights.suggestions.map((s: string, i: number) => (
                  <div key={i} className='flex items-start gap-2 p-3 bg-ministral-50 dark:bg-ministral-600/10 rounded-xl border border-ministral-100 dark:border-ministral-500/40'>
                    <span className='text-ministral-500 mt-0.5 shrink-0'><ChevronRight size={14}/></span>
                    <span className='text-sm text-ministral-500 dark:text-ministral-100'>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
  
          {healthInsights && (
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4'>
              {[
                { label: 'Sem disponibilidade', value: healthInsights.membersWithoutAvail?.length || 0, color: 'text-red-500' },
                { label: 'Sobrecarregados', value: healthInsights.overloaded?.length || 0, color: 'text-amber-500' },
                { label: 'Funções críticas', value: healthInsights.understaffed?.length || 0, color: 'text-orange-500' },
                { label: 'Trocas pendentes', value: healthInsights.pendingSwaps || 0, color: 'text-blue-500' },
              ].map((m, i) => (
                <div key={i} className='bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 text-center border border-zinc-100 dark:border-zinc-800'>
                  <div className={`text-2xl font-black ${m.color}`}>{m.value}</div>
                  <div className='text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1'>{m.label}</div>
                </div>
              ))}
            </div>
          )}
  
          <button onClick={handleAnalyzeHealth} disabled={healthLoading} className='mt-4 w-full sm:w-auto px-5 py-2.5 bg-ministral-500 hover:bg-ministral-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-60'>

            {healthLoading ? <Loader2 size={14} className='animate-spin'/> : <RefreshCw size={14}/>}
            {healthLoading ? 'Analisando...' : (healthInsights ? 'Reanalisar' : 'Analisar Saúde')}
          </button>
        </div>
      )}
  
      {/* ABA: CONFIGURAR IA */}
      {activeTab === 'schedule' && (
        <div className='bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700'>
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-4">Configuração da IA de Escala</h3>
          <div className="bg-ministral-50 dark:bg-ministral-600/10 text-ministral-500 dark:text-ministral-100 p-4 rounded-xl text-sm mb-6 flex items-start gap-3">
            <AlertCircleIcon size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Modelo Preferido</p>
              <p>Selecione abaixo qual modelo de inteligência artificial você deseja que seja o responsável por gerar as escalas automáticas no Editor de Escala.</p>
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Selecione o Modelo de IA</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AI_MODELS.map(model => (
                <button key={model.id} onClick={() => setSelectedModel(model.id)} className={`min-w-0 p-4 rounded-xl border-2 text-left transition-all ${selectedModel === model.id ? 'border-ministral-500 bg-ministral-50 dark:bg-ministral-600/10' : 'border-zinc-100 dark:border-zinc-700 hover:border-zinc-200 dark:hover:border-zinc-600'}`}>
                  <p className={`font-bold text-sm truncate ${selectedModel === model.id ? 'text-ministral-500 dark:text-ministral-400' : 'text-zinc-800 dark:text-zinc-200'}`}>{model.name}</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 break-words">{model.description}</p>
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSaveAIPreference} className="w-full sm:w-auto px-6 py-3 bg-ministral-500 hover:bg-ministral-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
            <CheckCircle2 size={20} />
            Salvar Modelo Preferido
          </button>
        </div>
      )}
  
      {/* ABA: ANALISE PREDITIVA */}
      {activeTab === 'predictive' && (
        <div className='bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 space-y-6'>
          <h3 className='font-bold text-zinc-800 dark:text-zinc-100'>Análise Preditiva e Alertas</h3>
          <p className='text-sm text-zinc-500'>Detecte problemas antes que eles aconteçam e receba sugestões de melhoria para sua escala.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                <Lightbulb size={16} className="text-amber-500" /> Sugestões de Escala
              </h4>
              <button 
                onClick={handleGetScaleSuggestions} 
                disabled={predictiveLoading}
                className="w-full py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-xl border border-amber-100 dark:border-amber-900/40 font-bold text-xs hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
              >
                {predictiveLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Analisar e Sugerir Melhorias
              </button>
              {scaleSuggestions && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                  {scaleSuggestions}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                <AlertOctagon size={16} className="text-red-500" /> Alertas Preventivos
              </h4>
              <button 
                onClick={handleGetPreventiveAlerts} 
                disabled={predictiveLoading}
                className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl border border-red-100 dark:border-red-900/40 font-bold text-xs hover:bg-red-100 transition-all flex items-center justify-center gap-2"
              >
                {predictiveLoading ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                Detectar Conflitos e Riscos
              </button>
              {preventiveAlerts && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                  {preventiveAlerts}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA: GERAR AVISOS */}
      {activeTab === 'messages' && (
        <div className='bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 space-y-5'>
          <h3 className='font-bold text-zinc-800 dark:text-zinc-100'>Gerador de Avisos Personalizados</h3>
          <p className='text-sm text-zinc-500'>Selecione um evento e a IA criará uma mensagem personalizada para cada membro escalado, pronta para enviar no WhatsApp.</p>
          <div>
            <label className='text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-2'>Selecione o Evento</label>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1'>
              {events.filter((e: any) => e.iso?.startsWith(currentMonth)).map((e: any) => (
                <button key={e.id || e.iso} onClick={() => { setSelectedEvent(e); setMessages([]); }} className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${selectedEvent?.iso === e.iso ? 'border-ministral-500 bg-ministral-50 dark:bg-ministral-600/10 text-ministral-500 dark:text-ministral-100' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                  <div>{e.title}</div>
                  <div className='text-zinc-400 font-normal mt-0.5'>{e.iso?.split('T')[0]?.split('-').reverse().join('/')} — {e.iso?.split('T')[1]?.slice(0, 5)}</div>
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleGenerateMessages} disabled={messagesLoading || !selectedEvent} className='px-5 py-2.5 bg-ministral-500 hover:bg-ministral-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-60'>

            {messagesLoading ? <Loader2 size={14} className='animate-spin'/> : <MessageSquare size={14}/>}
            {messagesLoading ? 'Gerando mensagens...' : 'Gerar Mensagens'}
          </button>
          {messages.length > 0 && (
            <div className='space-y-3'>
              <p className='text-xs font-bold text-zinc-500 uppercase tracking-wider'>
                {messages.length === 1 ? 'Aviso unificado gerado — pronto para o grupo' : `${messages.length} mensagens geradas — clique em Copiar para cada uma`}
              </p>
              {messages.map((msg: any, i: number) => (
                <div key={i} className='bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700'>
                  <div className='flex items-center justify-between mb-2'>
                    <div>
                      <span className='font-bold text-sm text-zinc-800 dark:text-zinc-100'>{msg.name}</span>
                      <span className='ml-2 text-[10px] bg-ministral-50 dark:bg-ministral-600/10 text-ministral-500 dark:text-ministral-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-tight'>{msg.role}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { 
                        const url = `https://wa.me/?text=${encodeURIComponent(msg.message)}`;
                        window.open(url, '_blank');
                      }} className='flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm'>
                        <Share2 size={12}/>
                        WhatsApp
                      </button>
                      <button onClick={() => { navigator.clipboard.writeText(msg.message); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); }} className='flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[10px] font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 transition-all'>
                        {copiedIdx === i ? <Check size={12}/> : <Copy size={12}/>}
                        {copiedIdx === i ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                  <p className='text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed'>{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
  
      {/* ABA: EXPLICAR DECISAO */}
      {activeTab === 'explain' && (
        <div className='bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 space-y-5'>
          <h3 className='font-bold text-zinc-800 dark:text-zinc-100'>Explicar Decisão da IA</h3>
          <p className='text-sm text-zinc-500'>Entenda por que cada membro foi escalado na escala atual (usando o modelo configurado).</p>
          
          {explainLoading && (
            <div className='flex flex-col items-center justify-center py-10 text-zinc-500 gap-3'>
              <Loader2 size={32} className='animate-spin text-ministral-500'/>
              <p className='text-sm font-medium'>A IA está analisando as decisões da escala...</p>
            </div>
          )}

          {explanation && (
            <div className='bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 animate-fade-in'>
              <h4 className='text-xs font-black text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2'><Brain size={14}/> Raciocínio da IA</h4>
              <div className='text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed'>{explanation}</div>
            </div>
          )}

          {!explainLoading && !explanation && Object.keys(schedule).length === 0 && (
            <div className='p-10 text-center text-zinc-500'>
              <AlertCircle size={40} className='mx-auto mb-3 opacity-20'/>
              <p>Não há dados de escala para explicar neste mês.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
