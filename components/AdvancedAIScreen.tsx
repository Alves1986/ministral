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
  AlertCircle as AlertCircleIcon,
  LineChart,
  Wand2,
  ShieldAlert,
  Settings,
  Megaphone
} from 'lucide-react';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { useToast } from './Toast';
import { getSupabase } from '../services/supabaseService';
import { runAI, AI_TASKS, AI_MODELS, DEFAULT_MODEL } from '../services/aiOrchestrator';
import { generateAISchedule } from '../services/aiScheduleService';

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
  onMonthChange?: (month: string) => void;
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
  onMonthChange,
  onScheduleGenerated
}) => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const { addToast } = useToast();

  const getAIContext = () => ({
    organization_name: orgName,
    ministry_name: ministryName,
    total_members: members.length,
    active_members: members.filter(m => m.status !== 'inactive').length,
    roles: roles
  });

  // Aba ativa da tela
  const [activeTab, setActiveTab] = useState<'health' | 'analysis' | 'conflicts' | 'generator' | 'messages' | 'schedule'>('health');

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

  // Recurso 3: Analise Preditiva (agora dividida)
  const [scaleSuggestions, setScaleSuggestions] = useState<string>('');
  const [preventiveAlerts, setPreventiveAlerts] = useState<string>('');
  const [predictiveLoading, setPredictiveLoading] = useState(false);

  // Recurso 4: Gerador de Escala (agora aba propria)
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [selectedSuggestionIdxs, setSelectedSuggestionIdxs] = useState<number[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Helper local para obter status de disponibilidade do membro
  const getMemberAvailabilityStatus = (
    memberId: string,
    date: string,
    eventTime: string
  ): 'available' | 'unavailable' => {
    const memberName = members.find(m => m.id === memberId || m.profile_id === memberId)?.name;
    if (!memberName) return 'unavailable';

    const memberAvail = availability[memberName];
    if (!memberAvail || !Array.isArray(memberAvail)) return 'unavailable';

    const monthKey = `${date.substring(0, 7)}-01`;
    if (memberAvail.includes(`${monthKey}_BLK`) || memberAvail.includes(monthKey)) {
      const isActuallyAvailable = memberAvail.includes(date) || memberAvail.includes(`${date}_${eventTime.slice(0, 5)}`);
      if (!isActuallyAvailable) return 'unavailable';
    }

    if (memberAvail.includes(date)) return 'available';

    const timePart = eventTime.slice(0, 5);
    if (memberAvail.includes(`${date}_${timePart}`)) return 'available';

    const hour = parseInt(timePart.split(':')[0], 10);
    const isMorning = hour < 12;
    if (isMorning && memberAvail.includes(`${date}_M`)) return 'available';
    if (!isMorning && memberAvail.includes(`${date}_N`)) return 'available';

    const weekday = new Date(date + 'T12:00:00').getDay();
    if (weekday !== 0 && !memberAvail.includes(`${date}_BLK`)) {
      return 'available';
    }

    if (memberAvail.includes(`${date}_BLK`)) return 'unavailable';

    return 'unavailable';
  };

  // Helper local para validar atribuições contra as regras de conflito (schedule_conflict_rules)
  const getConflictForProposal = (
    proposal: any,
    allProposed: any[]
  ) => {
    const memberId = proposal.member_id;
    const targetRole = proposal.role;
    const eventRuleId = proposal.event_rule_id;
    const eventDate = proposal.event_date;

    const monthlyOccurrences = events
      .filter((e: any) => e.iso?.startsWith(currentMonth))
      .map((e: any) => {
        const parts = e.id?.split('|') || [];
        return {
          ruleId: parts[0] || e.ruleId || 'single-event',
          date: e.iso?.split('T')[0],
          time: e.iso?.split('T')[1]?.slice(0, 5) || '19:00',
          title: e.title,
          iso: e.iso
        };
      });

    const currentEventOcc = monthlyOccurrences.find(o => o.ruleId === eventRuleId && o.date === eventDate);
    const eventTime = currentEventOcc?.time || '19:00';

    const currentAssignments: any[] = [];
    Object.entries(schedule).forEach(([key, memberName]: [string, any]) => {
      if (memberName && (key.includes(currentMonth.replace('-', '')) || key.includes(currentMonth))) {
        const parts = key.split('|');
        if (parts.length >= 3) {
          const ruleId = parts[0];
          const date = parts[1];
          const role = parts.slice(2).join('|');
          const m = members.find(mb => mb.name === memberName);
          if (m) {
            currentAssignments.push({
              event_rule_id: ruleId,
              event_date: date,
              role: role,
              member_id: m.id || m.profile_id
            });
          }
        }
      }
    });

    const otherAssignments = [
      ...currentAssignments,
      ...allProposed
        .filter(p => {
          const isCheckItem = p.event_rule_id === eventRuleId && p.event_date === eventDate && p.role === targetRole;
          if (isCheckItem) return false;
          const origIdx = allProposed.indexOf(p);
          return selectedSuggestionIdxs.includes(origIdx);
        })
    ];

    const availStatus = getMemberAvailabilityStatus(memberId, eventDate, eventTime);
    if (availStatus === 'unavailable') {
      return { conflict: true, msg: 'Membro indisponível na data/evento', type: 'availability' };
    }

    const memberRolesInEvent = otherAssignments
      .filter(a => a.member_id === memberId && a.event_rule_id === eventRuleId && a.event_date === eventDate)
      .map(a => a.role);

    const targetBaseRole = targetRole.replace(/\s\d+$/, '');

    const blockGroups = rules.filter(r => r.rule_type === 'block_group' || r.ruleType === 'block_group').map(r => r.functions) || [];
    const allowExceptions = rules.filter(r => r.rule_type === 'allow_exception' || r.ruleType === 'allow_exception').map(r => r.functions) || [];
    const memberBlocks = rules.filter(r => r.rule_type === 'block_members' || r.ruleType === 'block_members').map(r => r.functions) || [];

    for (const role of memberRolesInEvent) {
      const baseRole = role.replace(/\s\d+$/, '');
      if (baseRole === targetBaseRole) {
        return { conflict: true, msg: `Membro já escalado como ${role} neste evento`, type: 'duplicate_role' };
      }

      const inSameBlockGroup = blockGroups.some((group: string[]) => group.includes(targetBaseRole) && group.includes(baseRole));
      if (inSameBlockGroup) {
        const hasException = allowExceptions.some((exc: string[]) => 
          (exc.includes(targetBaseRole) && exc.includes(baseRole))
        );
        if (!hasException) {
          return { conflict: true, msg: `Conflito de Grupo de Bloqueio com função ${role}`, type: 'group_conflict' };
        }
      }
    }

    const otherMemberIdsInEvent = otherAssignments
      .filter(a => a.event_rule_id === eventRuleId && a.event_date === eventDate && a.member_id !== memberId)
      .map(a => a.member_id);

    for (const otherId of otherMemberIdsInEvent) {
      const isBlocked = memberBlocks.some((block: string[]) => block.includes(memberId) && block.includes(otherId));
      if (isBlocked) {
        const otherMemberName = members.find(m => (m.id === otherId || m.profile_id === otherId))?.name || 'membro bloqueado';
        return { conflict: true, msg: `Bloqueio de Membros: não pode servir junto com ${otherMemberName}`, type: 'member_block' };
      }
    }

    const dateObj = new Date(eventDate + 'T12:00:00');
    if (dateObj.getDay() === 0 && eventTime) {
      const hour = parseInt(eventTime.split(':')[0], 10);
      const isMorning = hour < 12;

      const otherAssignmentsThisDay = otherAssignments.filter(a => 
        a.member_id === memberId && 
        a.event_date === eventDate && 
        a.event_rule_id !== eventRuleId
      );

      for (const oAssign of otherAssignmentsThisDay) {
        const matchingOcc = monthlyOccurrences.find(occ => occ.ruleId === oAssign.event_rule_id && occ.date === eventDate);
        if (matchingOcc) {
          const assignedHour = parseInt(matchingOcc.time.split(':')[0], 10);
          const assignedMorning = assignedHour < 12;
          if (isMorning !== assignedMorning) {
            return { conflict: true, msg: 'Conflito de Turno: já escalado em outro período neste domingo', type: 'sunday_turn' };
          }
        }
      }
    }

    return { conflict: false };
  };

  const handleGenerateProposal = async () => {
    setIsGeneratingSuggestions(true);
    try {
      const monthlyOccurrences = events
        .filter((e: any) => e.iso?.startsWith(currentMonth))
        .map((e: any) => {
          const parts = e.id?.split('|') || [];
          return {
            ruleId: parts[0] || e.ruleId || 'single-event',
            date: e.iso?.split('T')[0],
            time: e.iso?.split('T')[1]?.slice(0, 5) || '19:00',
            title: e.title
          };
        });

      if (monthlyOccurrences.length === 0) {
        addToast("Não há eventos cadastrados neste mês para gerar sugestões.", "error");
        return;
      }

      const mappedAvailability: Record<string, string[]> = {};
      Object.entries(availability).forEach(([memberName, dates]) => {
        const m = members.find(mb => mb.name === memberName);
        if (m) {
          mappedAvailability[m.id || m.profile_id] = dates as string[];
        }
      });

      const existingAssignmentsInput: any[] = [];
      Object.entries(schedule).forEach(([key, memberName]: [string, any]) => {
        if (memberName && (key.includes(currentMonth.replace('-', '')) || key.includes(currentMonth))) {
          const parts = key.split('|');
          if (parts.length >= 3) {
            const ruleId = parts[0];
            const date = parts[1];
            const role = parts.slice(2).join('|');
            const m = members.find(mb => mb.name === memberName);
            if (m) {
              existingAssignmentsInput.push({
                event_rule_id: ruleId,
                event_date: date,
                role: role,
                member_id: m.id || m.profile_id
              });
            }
          }
        }
      });

      const blockGroups = rules.filter(r => r.rule_type === 'block_group' || r.ruleType === 'block_group').map(r => r.functions) || [];
      const allowExceptions = rules.filter(r => r.rule_type === 'allow_exception' || r.ruleType === 'allow_exception').map(r => r.functions) || [];
      const memberBlocks = rules.filter(r => r.rule_type === 'block_members' || r.ruleType === 'block_members').map(r => r.functions) || [];
      const memberPrefers = rules.filter(r => r.rule_type === 'prefer_together' || r.ruleType === 'prefer_together').map(r => r.functions) || [];

      const eventRoleExcludes = rules
        .filter((r: any) => r.rule_type === 'event_role_exclude' || r.label?.startsWith('[EVENT_ROLE_EXCLUDE]'))
        .reduce((acc: Record<string, string[]>, r: any) => {
          const match = r.label?.match(/event_rule_id=([\w-]+)/);
          if (match?.[1]) acc[match[1]] = r.functions || [];
          return acc;
        }, {});

      const conflictRulesInput = {
        blockGroups,
        allowExceptions,
        memberBlocks,
        memberPrefers
      };

      const input = {
        occurrences: monthlyOccurrences,
        roles: roles,
        members: members.map(m => ({
          id: m.id || m.profile_id,
          name: m.name,
          functions: m.ministry_functions || m.functions || []
        })),
        availability: mappedAvailability,
        existingAssignments: existingAssignmentsInput,
        rules: conflictRulesInput,
        eventRoleExcludes
      };

      const aiAssignments = await generateAISchedule(input as any, selectedModel || undefined);
      const safeAi = Array.isArray(aiAssignments) ? aiAssignments.filter(a => a && typeof a.event_date === 'string' && a.role && a.event_rule_id) : [];

      if (safeAi.length === 0) {
        addToast("A IA não identificou nenhuma vaga de escala que possa ser preenchida.", "info");
        return;
      }

      const newAssignments = safeAi.filter((ai: any) => {
        const datePart = ai.event_date.slice(0, 10);
        const alreadyExists = Object.entries(schedule).some(([key, memberName]) => {
          if (!memberName) return false;
          const parts = key.split('|');
          if (parts.length < 3) return false;
          const ruleId = parts[0];
          const date = parts[1];
          const role = parts.slice(2).join('|');
          return ruleId === ai.event_rule_id && date === datePart && role === ai.role;
        });
        return !alreadyExists;
      });

      if (newAssignments.length === 0) {
        addToast("Todos os eventos já estão com as vagas completamente preenchidas.", "info");
        return;
      }

      setAiSuggestions(newAssignments);
      setSelectedSuggestionIdxs(newAssignments.map((_, i) => i));
      addToast(`${newAssignments.length} sugestões de escala geradas pela IA! Analise a lista para validar.`, "success");
    } catch (e: any) {
      addToast("Erro ao gerar proposta: " + e.message, "error");
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleApplyProposed = async () => {
    const toApply = selectedSuggestionIdxs.map(idx => aiSuggestions[idx]).filter(Boolean);
    if (toApply.length === 0) {
      addToast("Nenhuma sugestão selecionada para aplicação.", "error");
      return;
    }
    
    onScheduleGenerated(toApply);
    setAiSuggestions([]);
    setSelectedSuggestionIdxs([]);
    addToast(`${toApply.length} atribuições enviadas para a escala com sucesso!`, "success");
  };

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
        runAI(AI_TASKS.MINISTRY_HEALTH, getAIContext(), payload, selectedModel),
        runAI(AI_TASKS.MEMBER_ANALYSIS, getAIContext(), payload, selectedModel)
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
  
      const result = await runAI(AI_TASKS.GENERATE_NOTICE, getAIContext(), payload, selectedModel);
      setMessages(result);
    } catch (e: any) {
      addToast('Erro ao gerar mensagens: ' + e.message, 'error');
    } finally {
      setMessagesLoading(false);
    }
  };

  const getReducedPayload = () => {
    return {
      schedule: Object.fromEntries(Object.entries(schedule).filter(([k]) => k.includes(currentMonth))),
      availability: Object.entries(availability).reduce((acc: any, [mId, av]: [string, any]) => {
        if (av) {
          acc[mId] = Object.fromEntries(Object.entries(av).filter(([k]) => k.startsWith(currentMonth)));
        }
        return acc;
      }, {}),
      members: members.map(m => ({ name: m.name, roles: m.ministry_functions, status: m.status })),
      events: events.filter(e => e.iso?.startsWith(currentMonth)).map(e => ({ title: e.title, date: e.iso })),
      roles
    };
  };

  const handleGetScaleSuggestions = async () => {
    setPredictiveLoading(true);
    try {
      const payload = getReducedPayload();
      const text = await runAI(AI_TASKS.SCALE_SUGGESTION, getAIContext(), payload, selectedModel);
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
      const payload = getReducedPayload();
      const text = await runAI(AI_TASKS.PREVENTIVE_ALERT, getAIContext(), payload, selectedModel);
      setPreventiveAlerts(text);
    } catch (e: any) {
      addToast('Erro ao obter alertas: ' + e.message, 'error');
    } finally {
      setPredictiveLoading(false);
    }
  };

  return (
    <div className='max-w-5xl mx-auto space-y-6 pb-10 animate-fade-in'>
  
      {/* HEADER */}
      <div className='bg-gradient-to-br from-ministral-500 to-ministral-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden'>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
              <Sparkles size={32} className="text-ministral-100" />
              IA Avançada
            </h2>
            <p className="text-ministral-50 max-w-2xl text-sm leading-relaxed">
              Utilize nossa inteligência artificial orquestrada para gerir seu ministério.
              Análise de saúde, geração de escalas e comunicação automatizada.
            </p>
          </div>
          
          {onMonthChange && (
            <div className="flex flex-col gap-2 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl w-full md:w-auto self-start">
              <p className="text-xs font-bold uppercase tracking-wider text-ministral-100 mb-1">Mês de Referência</p>
              <div className="flex items-center justify-between gap-4">
                  <button onClick={() => onMonthChange(adjustMonth(currentMonth, -1))} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                    <ChevronRight className="rotate-180" size={18} />
                  </button>
                  <span className="text-lg font-black min-w-[120px] text-center capitalize">{getMonthName(currentMonth)}</span>
                  <button onClick={() => onMonthChange(adjustMonth(currentMonth, 1))} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                    <ChevronRight size={18} />
                  </button>
              </div>
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10 pointer-events-none">
          <Sparkles size={200} />
        </div>
      </div>
  
      {/* NAVEGACAO DAS ABAS */}
      <div className='flex gap-2 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl overflow-x-auto scrollbar-hide'>
        {[
          { id: 'health',     label: 'Saúde',              icon: HeartPulse },
          { id: 'analysis',   label: 'Análise Preditiva',  icon: LineChart },
          { id: 'conflicts',  label: 'Detectar Conflitos', icon: ShieldAlert },
          { id: 'generator',  label: 'Gerador Inteligente',icon: Wand2 },
          { id: 'messages',   label: 'Avisos',             icon: Megaphone },
          { id: 'schedule',   label: 'Configuração',       icon: Settings },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-max flex items-center justify-center gap-2 py-2.5
              px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap
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
        <div className='bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 relative overflow-hidden'>
          <div className="absolute -top-4 -right-4 p-8 opacity-5 pointer-events-none"><HeartPulse size={160} /></div>
          
          <div className="relative z-10">
            <h3 className='font-bold text-zinc-800 dark:text-zinc-100 mb-2'>Saúde do Ministério</h3>
            <p className='text-sm text-zinc-500 mb-6'>Veja um diagnóstico completo de como anda a escala, sobrecargas e conflitos de membros do ministério.</p>
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
  
          <button onClick={handleAnalyzeHealth} disabled={healthLoading} className="mt-4 w-full sm:w-auto px-6 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-xl border border-amber-100 dark:border-amber-900/40 font-bold text-xs hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
            {healthLoading ? <Loader2 size={14} className='animate-spin'/> : <RefreshCw size={14}/>}
            {healthLoading ? 'Analisando...' : (healthInsights ? 'Reanalisar' : 'Analisar Saúde')}
          </button>
          </div>
        </div>
      )}
  
      {/* ABA: CONFIGURACAO */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className='bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 relative overflow-hidden'>
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><Settings size={120} /></div>
            <div className="relative z-10">
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
              <button key="save-ai-pref-btn" onClick={handleSaveAIPreference} className="w-full sm:w-auto px-6 py-3 bg-ministral-500 hover:bg-ministral-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={20} />
                Salvar Modelo Preferido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA: GERADOR INTELIGENTE */}
      {activeTab === 'generator' && (
        <div className="space-y-6">

          <div className='bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 relative overflow-hidden'>
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><Wand2 size={120} /></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={20} className="text-ministral-500" />
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Gerador e Validador Inteligente de Escala por IA</h3>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                A IA analisará as disponibilidades e sugerirá preenchimentos para as vagas vazias desse mês. Antes de aplicar, as sugestões serão validadas em tempo real contra as suas <strong>Regras de Conflito</strong> (ex: membros escalados em duas funções simultâneas ou bloqueio entre pessoas).
              </p>

            {aiSuggestions.length === 0 && (
              <button
                key="gen-proposal-btn"
                onClick={handleGenerateProposal}
                disabled={isGeneratingSuggestions}
                className="w-full py-8 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 transition-all font-bold flex flex-col items-center justify-center gap-3 text-sm cursor-pointer disabled:opacity-60 text-center"
              >
                {isGeneratingSuggestions ? (
                  <>
                    <Loader2 size={24} className="animate-spin text-ministral-500" />
                    <span>Gerando proposta de escala inteligente...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={24} className="text-ministral-500" />
                    <span>Gerar Proposta de Escala por IA para {getMonthName(currentMonth)}</span>
                  </>
                )}
              </button>
            )}

            {aiSuggestions.length > 0 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-100">Atribuições Recomendadas</h4>
                    <span className="text-xs text-zinc-500">
                      {selectedSuggestionIdxs.length} de {aiSuggestions.length} sugestões selecionadas para aplicação.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      key="sel-all-btn"
                      onClick={() => {
                        const allIdxs = aiSuggestions.map((_, i) => i);
                        setSelectedSuggestionIdxs(allIdxs);
                      }}
                      className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                      Selecionar Todas
                    </button>
                    <button
                      key="sel-clean-btn"
                      onClick={() => {
                        const cleanIdxs = aiSuggestions
                          .map((suggestion, index) => ({ suggestion, index }))
                          .filter(({ suggestion }) => !getConflictForProposal(suggestion, aiSuggestions).conflict)
                          .map(({ index }) => index);
                        setSelectedSuggestionIdxs(cleanIdxs);
                        addToast("Selecionadas apenas sugestões sem conflito.", "info");
                      }}
                      className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-lg text-xs font-bold text-amber-600 dark:text-amber-400 transition-colors"
                    >
                      Selecionar sem Conflito
                    </button>
                    <button
                      key="discard-sugg-btn"
                      onClick={() => {
                        setAiSuggestions([]);
                        setSelectedSuggestionIdxs([]);
                      }}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold transition-colors"
                    >
                      Descartar Tudo
                    </button>
                  </div>
                </div>

                {/* Exibir aviso se há conflitos nas selecionadas */}
                {(() => {
                  const selectedWithConflict = selectedSuggestionIdxs.filter(idx => {
                    const sugg = aiSuggestions[idx];
                    return sugg && getConflictForProposal(sugg, aiSuggestions).conflict;
                  });
                  if (selectedWithConflict.length > 0) {
                    return (
                      <div className="bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 flex gap-3 text-sm text-amber-800 dark:text-amber-300 animate-fade-in">
                        <AlertTriangle className="shrink-0 text-amber-500 mt-0.5" size={20} />
                        <div>
                          <p className="font-bold mb-1">Aviso de Regra de Conflito Ativa!</p>
                          <p>
                            Você possui <strong>{selectedWithConflict.length}</strong> sugestão(ões) com conflitos ativos selecionada(s). A aplicação dessas sugestões na escala física criará as colisões indicadas abaixo. Desmarque-as ou aplique com cautela.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Tabela de sugestões */}
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          <th className="py-3 px-4 w-12 text-center"></th>
                          <th className="py-3 px-4">Data do Evento</th>
                          <th className="py-3 px-4">Função / Papel</th>
                          <th className="py-3 px-4">Membro Sugerido</th>
                          <th className="py-3 px-4">Cruzamento de Conflito</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                        {aiSuggestions.map((suggestion, index) => {
                          const isSelected = selectedSuggestionIdxs.includes(index);
                          const memberDetail = members.find(m => m.id === suggestion.member_id || m.profile_id === suggestion.member_id);
                          
                          const monthlyOccurrences = events
                            .filter((e: any) => e.iso?.startsWith(currentMonth))
                            .map((e: any) => {
                              const parts = e.id?.split('|') || [];
                              return {
                                ruleId: parts[0] || e.ruleId || 'single-event',
                                date: e.iso?.split('T')[0],
                                time: e.iso?.split('T')[1]?.slice(0, 5) || '19:00',
                                title: e.title
                              };
                            });
                          const evt = monthlyOccurrences.find(o => o.ruleId === suggestion.event_rule_id && o.date === suggestion.event_date);
                          const dateFormatted = suggestion.event_date?.split('-').reverse().join('/');
                          const validation = getConflictForProposal(suggestion, aiSuggestions);

                          return (
                            <tr key={index} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-all ${validation.conflict && isSelected ? 'bg-amber-50/30 dark:bg-amber-955/10' : ''}`}>
                              <td className="py-4 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSuggestionIdxs(prev => [...prev, index]);
                                    } else {
                                      setSelectedSuggestionIdxs(prev => prev.filter(i => i !== index));
                                    }
                                  }}
                                  className="rounded text-ministral-500 border-zinc-300 focus:ring-ministral-500 h-4 w-4 shrink-0 cursor-pointer"
                                />
                              </td>
                              <td className="py-4 px-4">
                                <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm truncate">{evt ? evt.title : 'Evento'}</p>
                                <span className="text-[10px] text-zinc-400">{dateFormatted} {evt ? `— às ${evt.time}` : ''}</span>
                              </td>
                              <td className="py-4 px-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                  {suggestion.role}
                                </span>
                              </td>
                              <td className="py-4 px-4 font-semibold text-zinc-700 dark:text-zinc-300">
                                {memberDetail ? memberDetail.name : suggestion.member_name || 'Desconhecido'}
                              </td>
                              <td className="py-4 px-4">
                                {validation.conflict ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-300 text-xs font-semibold rounded-lg">
                                    <AlertTriangle size={12} className="shrink-0" />
                                    {validation.msg}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-955/40 border border-green-100 dark:border-green-900/30 text-green-600 dark:text-green-300 text-xs font-semibold rounded-lg">
                                    <CheckCircle2 size={12} className="shrink-0" />
                                    Sem conflitos
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Botão de confirmação de envio */}
                <div className="flex gap-3">
                  <button
                    key="apply-sugg-btn"
                    onClick={handleApplyProposed}
                    disabled={selectedSuggestionIdxs.length === 0}
                    className="px-6 py-3 bg-ministral-500 hover:bg-ministral-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
                  >
                    <CheckCircle2 size={20} />
                    Aplicar {selectedSuggestionIdxs.length} Sugestões Selecionadas na Escala
                  </button>
                  <button
                    key="discard-btn"
                    onClick={() => {
                      setAiSuggestions([]);
                      setSelectedSuggestionIdxs([]);
                    }}
                    className="px-5 py-3 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold rounded-xl transition-all text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
  
      {/* ABA: ANALISE PREDITIVA */}
      {activeTab === 'analysis' && (
        <div className='bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 relative overflow-hidden space-y-6'>
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><LineChart size={120} /></div>
          <div className="relative z-10">
            <h3 className='font-bold text-zinc-800 dark:text-zinc-100 mb-2'>Análise Preditiva e Sugestões</h3>
            <p className='text-sm text-zinc-500 mb-6'>Receba sugestões inteligentes de melhoria e otimização para a sua escala.</p>
            
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                <Lightbulb size={16} className="text-amber-500" /> Sugestões de Escala
              </h4>
              <button 
                onClick={handleGetScaleSuggestions} 
                disabled={predictiveLoading}
                className="w-full sm:w-auto px-6 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-xl border border-amber-100 dark:border-amber-900/40 font-bold text-xs hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
              >
                {predictiveLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Analisar e Sugerir Melhorias
              </button>
              {scaleSuggestions && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap max-h-[500px] overflow-y-auto custom-scrollbar animate-fade-in">
                  {scaleSuggestions}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA: DETECTAR CONFLITOS */}
      {activeTab === 'conflicts' && (
        <div className='bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 relative overflow-hidden space-y-6'>
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><ShieldAlert size={120} /></div>
          <div className="relative z-10">
            <h3 className='font-bold text-zinc-800 dark:text-zinc-100 mb-2'>Detectar Conflitos e Riscos</h3>
            <p className='text-sm text-zinc-500 mb-6'>Detecte problemas antes que eles aconteçam com a análise avançada de conflitos.</p>
            
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                <AlertOctagon size={16} className="text-red-500" /> Alertas Preventivos
              </h4>
              <button 
                onClick={handleGetPreventiveAlerts} 
                disabled={predictiveLoading}
                className="w-full sm:w-auto px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl border border-red-100 dark:border-red-900/40 font-bold text-xs hover:bg-red-100 transition-all flex items-center justify-center gap-2"
              >
                {predictiveLoading ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                Detectar Conflitos
              </button>
              {preventiveAlerts && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap max-h-[500px] overflow-y-auto custom-scrollbar animate-fade-in">
                  {preventiveAlerts}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA: GERAR AVISOS */}
      {activeTab === 'messages' && (
        <div className='bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 relative overflow-hidden space-y-6'>
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><Megaphone size={120} /></div>
          <div className="relative z-10">
            <h3 className='font-bold text-zinc-800 dark:text-zinc-100 mb-2'>Gerador de Avisos Personalizados</h3>
            <p className='text-sm text-zinc-500 mb-6'>Selecione um evento e a IA criará uma mensagem personalizada para cada membro escalado, pronta para enviar no WhatsApp.</p>
            <div className="mb-6">
              <label className='text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-3'>Selecione o Evento</label>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                {(() => {
                  const currentEvents = events.filter((e: any) => e.iso?.startsWith(currentMonth)).sort((a: any, b: any) => new Date(a.iso).getTime() - new Date(b.iso).getTime());
                  const now = new Date().getTime();
                  const nextEvent = currentEvents.find((e: any) => new Date(e.iso).getTime() >= now);
                  return currentEvents.map((e: any) => {
                    const isNext = nextEvent && nextEvent.iso === e.iso;
                    return (
                      <button key={e.id || e.iso} onClick={() => { setSelectedEvent(e); setMessages([]); }} className={`p-4 rounded-xl border text-left text-xs font-bold transition-all relative overflow-hidden ${selectedEvent?.iso === e.iso ? 'border-ministral-500 bg-ministral-50 dark:bg-ministral-600/10 text-ministral-500 dark:text-ministral-100' : isNext ? 'border-amber-400/80 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 hover:border-amber-500' : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                        {isNext && <span className={`absolute top-0 right-0 text-[9px] px-2 py-0.5 rounded-bl-lg font-black tracking-wider ${selectedEvent?.iso === e.iso ? 'bg-ministral-500 text-white' : 'bg-amber-400 text-amber-950'}`}>PRÓXIMO</span>}
                        <div className={`truncate text-sm ${isNext ? 'pr-14' : ''}`}>{e.title}</div>
                        <div className={`${selectedEvent?.iso === e.iso ? 'text-ministral-400 dark:text-ministral-300' : isNext ? 'text-amber-700/80 dark:text-amber-400/80' : 'text-zinc-400'} font-normal mt-1`}>{e.iso?.split('T')[0]?.split('-').reverse().join('/')} — {e.iso?.split('T')[1]?.slice(0, 5)}</div>
                      </button>
                    );
                  })
                })()}
              </div>
            </div>
            <button onClick={handleGenerateMessages} disabled={messagesLoading || !selectedEvent} className='w-full sm:w-auto px-6 py-3 bg-ministral-500 hover:bg-ministral-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60'>
              {messagesLoading ? <Loader2 size={18} className='animate-spin'/> : <MessageSquare size={18}/>}
              {messagesLoading ? 'Gerando mensagens...' : 'Gerar Mensagens'}
            </button>

            {messages.length > 0 && (
              <div className='mt-8 space-y-4 animate-fade-in'>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-100">Mensagens Geradas</h4>
                    <p className='text-xs text-zinc-500'>
                      {messages.length === 1 ? 'Aviso unificado pronto para o grupo.' : `${messages.length} mensagens geradas. Envie ou copie individualmente.`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {messages.map((msg: any, i: number) => (
                    <div key={i} className='bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between'>
                      <div>
                        <div className='flex items-start justify-between mb-4'>
                          <div>
                            <span className='font-black text-sm text-zinc-800 dark:text-zinc-100 block'>{msg.name}</span>
                            <span className='inline-block mt-1 text-[10px] bg-ministral-500/10 text-ministral-600 dark:text-ministral-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider'>{msg.role}</span>
                          </div>
                        </div>
                        <div className='text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed bg-white dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800'>
                          {msg.message}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <button onClick={() => { 
                          const url = `https://wa.me/?text=${encodeURIComponent(msg.message)}`;
                          window.open(url, '_blank');
                        }} className='flex-1 flex justify-center items-center gap-1.5 px-3 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold transition-all shadow-sm'>
                          <Share2 size={14}/>
                          Enviar WhatsApp
                        </button>
                        <button onClick={() => { navigator.clipboard.writeText(msg.message); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); }} className='flex-1 flex justify-center items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 transition-all'>
                          {copiedIdx === i ? <Check size={14}/> : <Copy size={14}/>}
                          {copiedIdx === i ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
