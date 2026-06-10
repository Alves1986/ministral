import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { 
    fetchRulesV2, 
    fetchAssignmentsV2, 
    fetchMembersV2, 
    fetchMinistryRoles,
    generateOccurrencesV2,
    saveAssignmentV2,
    removeAssignmentV2,
    confirmAssignmentV2,
    AssignmentV2,
    MemberV2,
    OccurrenceV2,
    fetchAvailabilityForEditor,
    fetchConflictRules,
    fetchGlobalConflictsV2
} from '../services/scheduleServiceV2';
import { 
    Loader2, 
    ChevronLeft, 
    ChevronRight, 
    Search, 
    Trash2, 
    AlertTriangle, 
    Calendar,
    ChevronDown,
    Check,
    Clock,
    Lock,
    Sparkles,
    X,
    CheckCircle2,
    User,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import { useToast } from './Toast';
import { generateAISchedule } from '../services/aiScheduleService';

// --- COMPONENTES AUXILIARES ---
import { ScheduleCell, getMemberAvailStatus, Avatar, isConflict } from './ScheduleCell';

const MemoizedEditorCell = React.memo<{
    occurrence: OccurrenceV2;
    role: string;
    members: MemberV2[];
    onAssign: (date: string, role: string, memberId: string | null, ruleId: string) => void;
    onConfirm: (date: string, role: string, ruleId: string) => void;
    processing: boolean;
    availability: any;
    conflictRules: any;
    assignments: AssignmentV2[];
    memberCounts: Record<string, number>;
    globalConflicts?: any;
    allOccurrences?: any;
}>(({ occurrence, role, members, onAssign, onConfirm, processing, availability, conflictRules, assignments, memberCounts, globalConflicts, allOccurrences }) => {
    const assignment = assignments.find(a => {
        const aDate = a.event_date?.slice(0, 10);
        const oDate = occurrence.date?.slice(0, 10);
        return aDate === oDate && a.role === role && a.event_rule_id === occurrence.ruleId;
    });

    return (
        <ScheduleCell 
            occurrence={occurrence}
            role={role}
            currentMemberId={assignment?.member_id || null}
            isConfirmed={assignment?.confirmed || false}
            members={members}
            onAssign={onAssign}
            onConfirm={onConfirm}
            processing={processing}
            availability={availability}
            eventTime={occurrence.time}
            conflictRules={conflictRules}
            assignments={assignments}
            memberCounts={memberCounts}
            globalConflicts={globalConflicts}
            allOccurrences={allOccurrences}
        />
    );
}, (prev, next) => {
    if (prev.occurrence.date !== next.occurrence.date) return false;
    if (prev.occurrence.ruleId !== next.occurrence.ruleId) return false;
    if (prev.role !== next.role) return false;
    if (prev.processing !== next.processing) return false;
    if (prev.availability !== next.availability) return false;
    if (prev.conflictRules !== next.conflictRules) return false;
    if (prev.globalConflicts !== next.globalConflicts) return false;
    if (prev.members !== next.members) return false;

    const prevDateAssignments = prev.assignments.filter(a => a.event_date?.slice(0, 10) === prev.occurrence.date.slice(0, 10));
    const nextDateAssignments = next.assignments.filter(a => a.event_date?.slice(0, 10) === next.occurrence.date.slice(0, 10));
    
    if (prevDateAssignments.length !== nextDateAssignments.length) return false;
    const sameAssignments = prevDateAssignments.every(pa => 
        nextDateAssignments.some(na => na.member_id === pa.member_id && na.role === pa.role && na.event_rule_id === pa.event_rule_id)
    );
    if (!sameAssignments) return false;

    const baseRole = prev.role.replace(/\s\d+$/, '');
    const roleMembers = prev.members.filter(m => m.ministry_functions?.includes(baseRole));
    for (const m of roleMembers) {
        if (prev.memberCounts[m.id] !== next.memberCounts[m.id]) return false;
    }

    return true;
});

// --- COMPONENTE PRINCIPAL ---

interface Props {
    ministryId: string;
    orgId: string;
    currentMonth: string; // YYYY-MM
    onMonthChange: (month: string) => void;
    currentTab?: string;
    isAdmin?: boolean;
    isPro?: boolean;
    roles: string[];
}

export const ScheduleEditorV2: React.FC<Props> = ({ ministryId, orgId, currentMonth, onMonthChange, currentTab, isAdmin, isPro, roles }) => {
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    
    // -- STATE --
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [showConfirmAI, setShowConfirmAI] = useState(false);
    const [showConfirmRebalance, setShowConfirmRebalance] = useState(false);
    const [showReviewAI, setShowReviewAI] = useState(false);
    const [isRebalanceMode, setIsRebalanceMode] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
    const [showAlertsList, setShowAlertsList] = useState(false);
    
    const [members, setMembers] = useState<MemberV2[]>([]);
    const [assignments, setAssignments] = useState<AssignmentV2[]>([]);
    const [occurrences, setOccurrences] = useState<OccurrenceV2[]>([]);
    const [availability, setAvailability] = useState<Record<string, Record<string, string>>>({});
    const [memberNotes, setMemberNotes] = useState<Record<string, string>>({});
    const [conflictRules, setConflictRules] = useState<{ blockGroups: string[][], allowExceptions: string[][], memberBlocks: string[][], memberPrefers: string[][], eventRoleExcludes: Record<string, string[]> }>({ blockGroups: [], allowExceptions: [], memberBlocks: [], memberPrefers: [], eventRoleExcludes: {} });
    const [globalConflicts, setGlobalConflicts] = useState<Record<string, { date: string, ministryId: string, role: string }[]>>({});

    // -- DERIVED STATE --
    const memberCounts = assignments.reduce((acc, curr) => {
        if (curr.member_id && curr.role !== '__EVENT_EXCLUDED__') {
            acc[curr.member_id] = (acc[curr.member_id] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    // -- EXCLUSÕES --
    const excludedOccurrences = useMemo(() => {
        return assignments.filter(a => a.role === '__EVENT_EXCLUDED__');
    }, [assignments]);

    const visibleOccurrences = useMemo(() => {
        return occurrences.filter(occ => {
            const isExcluded = excludedOccurrences.some((ex: AssignmentV2) => 
                ex.event_date.slice(0, 10) === occ.date.slice(0, 10) && 
                ex.event_rule_id === occ.ruleId
            );
            return !isExcluded;
        });
    }, [occurrences, excludedOccurrences]);

    // -- REACT QUERY FOR SYNC --
    const { data: realtimeAssignments, isFetching: isFetchingAssignments } = useQuery({
        queryKey: ['assignments', ministryId, currentMonth, orgId, 'v2'],
        queryFn: () => fetchAssignmentsV2(ministryId, orgId, currentMonth),
        enabled: Boolean(ministryId && orgId && ministryId.length === 36 && orgId.length === 36),
        staleTime: 60 * 1000,
    });

    // Update local state when realtime assignments change from outside
    useEffect(() => {
        if (realtimeAssignments && !processing && !isGeneratingAI) {
             setAssignments(realtimeAssignments);
        }
    }, [realtimeAssignments, processing, isGeneratingAI]);

    // -- LOAD DATA --
    const loadData = async () => {
        setLoading(true);
        try {
            const [membersData, rules, availResult, conflictRulesData, globalData] = await Promise.all([
                fetchMembersV2(ministryId, orgId),
                fetchRulesV2(ministryId, orgId),
                fetchAvailabilityForEditor(ministryId, orgId),
                fetchConflictRules(ministryId, orgId),
                fetchGlobalConflictsV2(ministryId, orgId, currentMonth)
            ]);

            setMembers(membersData);
            setAvailability(availResult.availability);
            setMemberNotes(availResult.memberNotes);
            setConflictRules(conflictRulesData);
            setGlobalConflicts(globalData);

            // Gerar ocorrências do mês
            const [yearStr, monthStrPart] = currentMonth.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStrPart, 10);
            
            const generatedOccurrences = generateOccurrencesV2(rules, year, month);
            setOccurrences(generatedOccurrences);
            
            // Note: assignments are now loaded and synced via useQuery
        } catch (error) {
            console.error(error);
            addToast('Erro ao carregar dados da escala', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Guard: so executa se ambos forem UUIDs validos
        if (!ministryId || !orgId || ministryId.length !== 36 || orgId.length !== 36) {
            setLoading(false);
            return;
        }
        loadData();
    }, [currentMonth, ministryId, orgId]);

    useEffect(() => {
        const handleRevalidate = () => loadData();
        window.addEventListener('schedule-reloaded', handleRevalidate);
        return () => window.removeEventListener('schedule-reloaded', handleRevalidate);
    }, [ministryId, orgId, currentMonth]);

    const prevTabRef = useRef(currentTab);
    useEffect(() => {
        if (prevTabRef.current === 'schedule-rules' && currentTab === 'schedule-editor') {
            loadData();
        }
        prevTabRef.current = currentTab;
    }, [currentTab]);

    // -- HANDLERS --
    const handlePrevMonth = () => {
        const [year, month] = currentMonth.split('-').map(Number);
        const d = new Date(year, month - 2, 1);
        const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        onMonthChange(newMonth);
    };

    const handleNextMonth = () => {
        const [year, month] = currentMonth.split('-').map(Number);
        const d = new Date(year, month, 1);
        const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        onMonthChange(newMonth);
    };

    const handleGenerateAI = async () => {
        setShowConfirmAI(false);
        setIsGeneratingAI(true);
        try {
            // Construct AI Availability that also blocks out cross-ministry days
            const aiAvailability = JSON.parse(JSON.stringify(availability));
            Object.entries(globalConflicts).forEach(([memberId, conflicts]) => {
                if (!aiAvailability[memberId]) {
                    aiAvailability[memberId] = {};
                }
                conflicts.forEach(c => {
                    // Mark as unavailable for the specific date if they have a cross-ministry event
                    aiAvailability[memberId][c.date] = 'unavailable';
                });
            });

            const input = {
                occurrences: occurrences.map(o => ({
                    date: o.date,
                    time: o.time,
                    ruleId: o.ruleId,
                    title: o.title
                })),
                roles: roles,
                members: members.map(m => ({
                    id: m.id,
                    name: m.name,
                    functions: m.ministry_functions || []
                })),
                availability: aiAvailability,
                existingAssignments: assignments.map(a => ({
                    event_rule_id: a.event_rule_id,
                    event_date: a.event_date,
                    role: a.role,
                    member_id: a.member_id
                })),
                rules: conflictRules,
                eventRoleExcludes: conflictRules.eventRoleExcludes,
                memberNotes,
                mode: 'fill' as const
            };

            const savedModel = localStorage.getItem(`ai_model_preference_${ministryId}`);
            const aiAssignments = await generateAISchedule(input, savedModel || undefined);
            
            // Garantir que todos tem .slice
            const safeAi = Array.isArray(aiAssignments) ? aiAssignments.filter(a => a && typeof a.event_date === 'string' && a.role && a.event_rule_id) : [];
            
            // Filtrar apenas o que NÃO está preenchido
            const newAssignments = safeAi.filter((ai: any) => {
                const alreadyExists = assignments.some(a => 
                    a.event_date && typeof a.event_date === 'string' &&
                    a.event_date.slice(0, 10) === ai.event_date.slice(0, 10) && 
                    a.role === ai.role && 
                    a.event_rule_id === ai.event_rule_id
                );
                return !alreadyExists;
            });

            if (newAssignments.length === 0) {
                addToast(`A IA retornou: ${JSON.stringify(aiAssignments).substring(0, 150)}...`, 'info');
                setIsGeneratingAI(false);
                return;
            }

            setAiSuggestions(newAssignments);
            setShowReviewAI(true);
        } catch (error: any) {
            console.error(error);
            const msg = error instanceof Error ? error.message : 'Erro desconhecido';
            addToast(`Erro ao gerar escala com IA: ${msg}`, 'error');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleApplyAISuggestions = async () => {
        setProcessing(true);
        setShowReviewAI(false);
        try {
            for (const item of aiSuggestions) {
                // Modo rebalance: remove a atribuição antiga antes de salvar a nova
                if (item.replacedMemberId) {
                    await removeAssignmentV2(ministryId, orgId, {
                        event_rule_id: item.event_rule_id,
                        event_date: item.event_date,
                        role: item.role
                    });
                }
                await saveAssignmentV2(ministryId, orgId, {
                    event_rule_id: item.event_rule_id,
                    event_date: item.event_date,
                    role: item.role,
                    member_id: item.member_id
                });
            }
            const label = isRebalanceMode ? 'trocas de equilíbrio aplicadas' : 'atribuições aplicadas';
            addToast(`${aiSuggestions.length} ${label} com sucesso!`, 'success');
            queryClient.invalidateQueries({ queryKey: ['assignments', ministryId, currentMonth, orgId] });
            queryClient.invalidateQueries({ queryKey: ['nextEvent', ministryId, orgId] });
            queryClient.invalidateQueries({ queryKey: ['conflicts', ministryId, currentMonth, orgId] });
            await loadData();
        } catch (error) {
            console.error(error);
            addToast('Erro ao aplicar sugestões da IA', 'error');
        } finally {
            setProcessing(false);
            setAiSuggestions([]);
            setIsRebalanceMode(false);
        }
    };

    const handleRebalanceAI = async () => {
        setShowConfirmRebalance(false);
        setIsGeneratingAI(true);
        try {
            const aiAvailability = JSON.parse(JSON.stringify(availability));
            Object.entries(globalConflicts).forEach(([memberId, conflicts]) => {
                if (!aiAvailability[memberId]) aiAvailability[memberId] = {};
                conflicts.forEach(c => { aiAvailability[memberId][c.date] = 'unavailable'; });
            });
            const input = {
                occurrences: occurrences.map(o => ({ date: o.date, time: o.time, ruleId: o.ruleId, title: o.title })),
                roles,
                members: members.map(m => ({ id: m.id, name: m.name, functions: m.ministry_functions || [] })),
                availability: aiAvailability,
                existingAssignments: assignments.map(a => ({
                    event_rule_id: a.event_rule_id,
                    event_date: a.event_date,
                    role: a.role,
                    member_id: a.member_id
                })),
                rules: conflictRules,
                eventRoleExcludes: conflictRules.eventRoleExcludes,
                memberNotes,
                mode: 'rebalance' as const
            };
            const savedModel = localStorage.getItem(`ai_model_preference_${ministryId}`);
            const aiAssignments = await generateAISchedule(input as any, savedModel || undefined);
            const safeAi = Array.isArray(aiAssignments)
                ? aiAssignments.filter((a: any) => a && typeof a.event_date === 'string' && a.role && a.event_rule_id)
                : [];
            if (safeAi.length === 0) {
                addToast('A escala já está bem equilibrada! Nenhuma troca necessária.', 'info');
                return;
            }
            setAiSuggestions(safeAi);
            setIsRebalanceMode(true);
            setShowReviewAI(true);
        } catch (error: any) {
            console.error(error);
            const msg = error instanceof Error ? error.message : 'Erro desconhecido';
            addToast(`Erro ao reequilibrar escala: ${msg}`, 'error');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleConfirmAssignment = useCallback(async (date: string, role: string, ruleId: string) => {
        setProcessing(true);
        let previousAssignments: AssignmentV2[] = [];
        
        setAssignments(prev => {
            previousAssignments = [...prev];
            return prev.map(a => {
                if (a.event_date === date && a.role === role && a.event_rule_id === ruleId) {
                    return { ...a, confirmed: true };
                }
                return a;
            });
        });

        try {
            await confirmAssignmentV2(ministryId, orgId, {
                event_rule_id: ruleId,
                event_date: date,
                role
            });
            addToast('Presença confirmada manualmente', 'success');
            queryClient.invalidateQueries({ queryKey: ['assignments', ministryId, currentMonth, orgId] });
        } catch (error) {
            console.error(error);
            addToast('Erro ao confirmar presença', 'error');
            setAssignments(previousAssignments);
        } finally {
            setProcessing(false);
        }
    }, [ministryId, orgId, currentMonth, queryClient, addToast]);

    const handleAssignmentChange = useCallback(async (date: string, role: string, memberId: string | null, ruleId: string) => {
        setProcessing(true);
        
        const tempId = `temp-${Date.now()}`;
        let previousAssignments: AssignmentV2[] = [];
        
        // Atualização Otimista
        setAssignments(prev => {
            previousAssignments = [...prev];
            const filtered = prev.filter(a => !(a.event_date === date && a.role === role && a.event_rule_id === ruleId));
            const next = memberId
                ? [...filtered, {
                    id: tempId,
                    event_rule_id: ruleId, 
                    event_date: date,
                    role,
                    member_id: memberId,
                    confirmed: false,
                    event_key: ruleId
                }]
                : filtered;
            return next;
        });

        try {
            if (memberId) {
                await saveAssignmentV2(ministryId, orgId, {
                    event_rule_id: ruleId,
                    event_date: date,
                    role,
                    member_id: memberId
                });
                
                const occurrence = occurrences.find(o => o.date === date && o.ruleId === ruleId);
                if (occurrence) {
                    const status = getMemberAvailStatus(memberId, date, occurrence.time, availability);
                    if (status === 'unavailable') {
                        addToast('Atencao: membro escalado sem disponibilidade registrada', 'warning');
                    } else {
                        addToast('Membro escalado', 'success');
                    }
                } else {
                    addToast('Membro escalado', 'success');
                }
            } else {
                await removeAssignmentV2(ministryId, orgId, {
                    event_rule_id: ruleId,
                    event_date: date,
                    role
                });
                addToast('Removido da escala', 'success');
            }
            queryClient.invalidateQueries({ queryKey: ['assignments', ministryId, currentMonth, orgId] });
            queryClient.invalidateQueries({ queryKey: ['nextEvent', ministryId, orgId] });
            queryClient.invalidateQueries({ queryKey: ['conflicts', ministryId, currentMonth, orgId] });
        } catch (error) {
            console.error(error);
            addToast('Erro ao salvar alteração', 'error');
            setAssignments(previousAssignments); // Reverte em caso de erro
        } finally {
            setProcessing(false);
        }
    }, [ministryId, orgId, currentMonth, availability, occurrences, queryClient, addToast]);

    const handleExcludeOccurrence = async (occ: OccurrenceV2) => {
        if (!window.confirm(`Deseja realmente excluir o evento "${occ.title}" do dia ${occ.date.split('-').reverse().join('/')}? Esta ação afetará apenas este mês.`)) {
            return;
        }

        setProcessing(true);
        try {
            await saveAssignmentV2(ministryId, orgId, {
                event_rule_id: occ.ruleId,
                event_date: occ.date,
                role: '__EVENT_EXCLUDED__',
                member_id: null as any
            });
            addToast('Evento removido da escala deste mês', 'success');
            queryClient.invalidateQueries({ queryKey: ['assignments', ministryId, currentMonth, orgId] });
            queryClient.invalidateQueries({ queryKey: ['nextEvent', ministryId, orgId] });
            queryClient.invalidateQueries({ queryKey: ['conflicts', ministryId, currentMonth, orgId] });
            await loadData();
        } catch (error) {
            console.error(error);
            addToast('Erro ao remover evento', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const hasExistingAssignments = assignments.some(a => a.role !== '__EVENT_EXCLUDED__' && a.member_id);

    if (loading || isGeneratingAI) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                <Loader2 className="animate-spin mb-2" />
                <p>{isGeneratingAI ? 'Gerando escala com IA...' : 'Carregando escala...'}</p>
            </div>
        );
    }

    const [year, month] = currentMonth.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    const monthLabel = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const shortMonthLabel = d.toLocaleDateString('pt-BR', { month: 'short' });

    const disponiveisNoMes = members.filter(m => {
        const memberAvail = availability[m.id];
        if (!memberAvail) return false;
        const monthKey = `${currentMonth}-01`;
        if (memberAvail[monthKey] === 'BLK') return false;
        return Object.keys(memberAvail).some(date => date.startsWith(currentMonth));
    }).length;

    const detailedAlerts: { 
        id: string;
        memberId: string;
        memberName: string;
        date: string;
        ruleId: string;
        eventTitle: string;
        time: string;
        role: string;
        type: 'unavailable' | 'conflict';
        message: string;
    }[] = [];

    assignments.forEach(a => {
        const occurrence = occurrences.find(o => o.date === a.event_date && o.ruleId === a.event_rule_id);
        if (!occurrence || a.role === '__EVENT_EXCLUDED__' || !a.member_id) return;
        
        const member = members.find(m => m.id === a.member_id);
        const memberName = member ? member.name : 'Membro Desconhecido';
        
        const status = getMemberAvailStatus(a.member_id, a.event_date, occurrence.time, availability);
        if (status === 'unavailable') {
            detailedAlerts.push({
                id: `${a.member_id}-${a.event_date}-${occurrence.ruleId}-${a.role}`,
                memberId: a.member_id,
                memberName,
                date: a.event_date,
                ruleId: occurrence.ruleId,
                eventTitle: occurrence.title,
                time: occurrence.time,
                role: a.role,
                type: 'unavailable',
                message: `${memberName} marcou indisponibilidade para este dia.`
            });
            return;
        }

        const otherAssignments = assignments.filter(other => !(other.member_id === a.member_id && other.role === a.role && other.event_rule_id === occurrence.ruleId && other.event_date === occurrence.date));
        const conflict = isConflict(a.member_id, a.role, occurrence.ruleId, occurrence.date, otherAssignments, conflictRules, globalConflicts, occurrences, occurrence.time);
        
        if (conflict.conflict) {
            detailedAlerts.push({
                id: `${a.member_id}-${a.event_date}-${occurrence.ruleId}-${a.role}`,
                memberId: a.member_id,
                memberName,
                date: a.event_date,
                ruleId: occurrence.ruleId,
                eventTitle: occurrence.title,
                time: occurrence.time,
                role: a.role,
                type: 'conflict',
                message: conflict.existingRole ? `Conflito com a função: ${conflict.existingRole}` : `Conflito de regra de escala.`
            });
        }
    });

    const alertas = detailedAlerts.length;

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col h-full">
            {/* HEADER */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <div className="bg-secondary/10 dark:bg-secondary/5 p-2.5 rounded-xl text-secondary shrink-0">
                        <Calendar size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
                            Resumo do Mês
                        </h2>
                        <div className="text-sm text-zinc-500 mt-1 leading-relaxed">
                            {occurrences.length} eventos • {members.length} membros ativos
                            <br className="hidden sm:block" />
                            <span className="sm:hidden"> • </span>
                            {disponiveisNoMes} disponíveis este mês • {' '}
                            {alertas > 0 ? (
                                <button 
                                    onClick={() => setShowAlertsList(true)}
                                    className="text-red-500 font-bold hover:underline"
                                >
                                    {alertas} {alertas === 1 ? 'alerta' : 'alertas'}
                                </button>
                            ) : (
                                <span>0 alertas</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                    <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-full sm:w-auto">
                        <button 
                            onClick={handlePrevMonth}
                            className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 transition-all shadow-sm"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="w-40 text-center font-bold text-zinc-700 dark:text-zinc-300 capitalize">
                            {monthLabel}
                        </span>
                        <button 
                            onClick={handleNextMonth}
                            className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 transition-all shadow-sm"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {isAdmin && (
                        <div className="flex gap-2 w-full sm:w-auto">
                            <div className="relative group flex-1 sm:flex-none">
                                <button
                                    onClick={() => isPro && setShowConfirmAI(true)}
                                    disabled={!isPro || isGeneratingAI}
                                    className={`w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-lg
                                        ${isPro 
                                            ? 'bg-gradient-to-r from-secondary to-secondaryHover hover:from-secondaryHover hover:to-secondary text-white shadow-secondary/20' 
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed shadow-none'
                                        }
                                    `}
                                >
                                    <Sparkles size={18} className={isPro ? 'animate-pulse' : ''} />
                                    Gerar Automático
                                </button>
                                {!isPro && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                        Disponível no Plano Pro
                                    </div>
                                )}
                            </div>
                            {isPro && hasExistingAssignments && (
                                <button
                                    onClick={() => setShowConfirmRebalance(true)}
                                    disabled={isGeneratingAI}
                                    title="Sugerir trocas para equilibrar a carga do mês"
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-lg bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 disabled:opacity-60"
                                >
                                    <RefreshCw size={16} />
                                    Equilibrar
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* AREA DA TABELA */}
            <div className="flex-1 overflow-auto custom-scrollbar p-1 pb-40"> 
                {/* Desktop View (Table) */}
                <div className="hidden md:block">
                    <table className="w-full text-sm border-separate border-spacing-0">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="p-3 text-left font-semibold text-zinc-500 min-w-[150px] bg-zinc-50 dark:bg-zinc-900 sticky left-0 z-30">
                                    Data / Evento
                                </th>
                                {roles.map(role => (
                                    <th key={role} className="p-3 text-center font-semibold text-zinc-500 min-w-[160px] bg-zinc-50 dark:bg-zinc-900">
                                        {role.toUpperCase()}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="">
                            {visibleOccurrences.map((occurrence: OccurrenceV2) => (
                                <tr key={`${occurrence.date}-${occurrence.time}-${occurrence.ruleId}`} className="group hover:bg-zinc-50/80 dark:hover:bg-zinc-800/20 even:bg-zinc-50/30 dark:even:bg-zinc-800/10">
                                    {/* Coluna Fixa de Data */}
                                    <td className="p-3 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50/80 dark:group-hover:bg-zinc-800/20 sticky left-0 z-10 border-r border-zinc-200 dark:border-zinc-800">
                                        <div className="flex items-center justify-between group/row-header">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                                    {new Date(`${occurrence.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
                                                </span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 rounded">
                                                        {occurrence.time.substring(0, 5)}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400 truncate max-w-[80px]" title={occurrence.title}>
                                                        {occurrence.title}
                                                    </span>
                                                </div>
                                            </div>
                                            {isAdmin && (
                                                <button 
                                                    onClick={() => handleExcludeOccurrence(occurrence)} 
                                                    className="p-1 px-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all opacity-0 group-hover/row-header:opacity-100"
                                                    title="Excluir evento deste mês"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    
                                    {roles.map(role => {
                                        return (
                                            <td id={`cell-${occurrence.date}-${role}`} key={`${occurrence.date}-${role}`} className="p-2 relative">
                                                <MemoizedEditorCell 
                                                    occurrence={occurrence}
                                                    role={role}
                                                    members={members}
                                                    onAssign={handleAssignmentChange}
                                                    onConfirm={handleConfirmAssignment}
                                                    processing={processing}
                                                    availability={availability}
                                                    conflictRules={conflictRules}
                                                    assignments={assignments}
                                                    memberCounts={memberCounts}
                                                    globalConflicts={globalConflicts}
                                                    allOccurrences={occurrences}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View (Cards) */}
                <div className="md:hidden space-y-4 p-2">
                    {visibleOccurrences.map((occurrence: OccurrenceV2) => {
                        const dateObj = new Date(`${occurrence.date}T12:00:00`);
                        const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                        const dayNum = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });

                        return (
                            <div key={`${occurrence.date}-${occurrence.time}-${occurrence.ruleId}`} className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
                                    <div className="flex flex-col items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg w-12 h-12 shrink-0 shadow-sm">
                                        <span className="text-[10px] font-bold text-red-500 uppercase">{dayName}</span>
                                        <span className="text-lg font-bold text-zinc-800 dark:text-zinc-100 leading-none">{dayNum}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-zinc-800 dark:text-zinc-100 truncate">{occurrence.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="flex items-center gap-1 text-xs text-zinc-500 bg-zinc-200/50 dark:bg-zinc-700/50 px-2 py-0.5 rounded-full">
                                                <Clock size={10} />
                                                {occurrence.time.substring(0, 5)}
                                            </span>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <button 
                                            onClick={() => handleExcludeOccurrence(occurrence)}
                                            className="p-2 text-zinc-400 hover:text-red-500"
                                            title="Excluir evento"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                                <div className="p-4 space-y-4">
                                    {roles.map(role => {
                                        return (
                                            <div id={`cell-${occurrence.date}-${role}`} key={`${occurrence.date}-${role}`} className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">{role}</label>
                                                <MemoizedEditorCell 
                                                    occurrence={occurrence}
                                                    role={role}
                                                    members={members}
                                                    onAssign={handleAssignmentChange}
                                                    onConfirm={handleConfirmAssignment}
                                                    processing={processing}
                                                    availability={availability}
                                                    conflictRules={conflictRules}
                                                    assignments={assignments}
                                                    memberCounts={memberCounts}
                                                    globalConflicts={globalConflicts}
                                                    allOccurrences={occurrences}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal de Revisão IA */}
            {showReviewAI && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRebalanceMode ? 'bg-amber-500/10 text-amber-500' : 'bg-secondary/10 dark:bg-secondary/5 text-secondary'}`}>
                                    {isRebalanceMode ? <RefreshCw size={20} /> : <Sparkles size={20} />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight">
                                        {isRebalanceMode ? 'Revisar Trocas de Equilíbrio' : 'Revisar Sugestões da IA'}
                                    </h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                                        {isRebalanceMode
                                            ? `${aiSuggestions.length} trocas sugeridas para equilibrar o mês`
                                            : `${aiSuggestions.length} novas atribuições encontradas`
                                        }
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => { setShowReviewAI(false); setIsRebalanceMode(false); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {aiSuggestions.map((item, i) => {
                                    const member = members.find(m => m.id === item.member_id);
                                    const replacedMember = item.replacedMemberId ? members.find(m => m.id === item.replacedMemberId) : null;
                                    const dateObj = new Date(`${item.event_date}T12:00:00`);
                                    const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
                                    const dayNum = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });
                                    const currentCount = memberCounts[item.member_id] || 0;
                                    const replacedCount = item.replacedMemberId ? (memberCounts[item.replacedMemberId] || 0) : 0;
                                    return (
                                        <div key={i} className="flex flex-col gap-1.5 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50 transition-all hover:border-secondary/20">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg w-10 h-10 shrink-0 shadow-sm">
                                                    <span className="text-[8px] font-bold text-red-500 uppercase leading-none mb-0.5">{dayName}</span>
                                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 leading-none">{dayNum}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[9px] font-black text-secondary uppercase tracking-wider truncate mb-0.5">{item.role}</div>
                                                    <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                                        {member?.name || 'Membro'}
                                                        <span className="ml-1 text-[10px] font-normal text-zinc-400">({currentCount}x mês)</span>
                                                    </div>
                                                    {replacedMember && (
                                                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 truncate">
                                                            ⇔ substitui {replacedMember.name} ({replacedCount}x)
                                                        </div>
                                                    )}
                                                </div>
                                                <CheckCircle2 size={16} className="text-secondary opacity-40 shrink-0" />
                                            </div>
                                            {item.memberNote && (
                                                <div className="flex items-start gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-2.5 py-1.5">
                                                    <AlertCircle size={10} className="shrink-0 mt-0.5" />
                                                    <span><strong>Obs do membro:</strong> {item.memberNote}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                            <button 
                                onClick={() => { setShowReviewAI(false); setIsRebalanceMode(false); }}
                                className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                            >
                                Descartar
                            </button>
                            <button 
                                onClick={handleApplyAISuggestions}
                                disabled={processing}
                                className={`px-6 py-2 text-white text-sm font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70 ${
                                    isRebalanceMode
                                        ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                                        : 'bg-secondary hover:bg-secondaryHover shadow-secondary/20'
                                }`}
                            >
                                {processing ? <Loader2 size={16} className="animate-spin" /> : isRebalanceMode ? <RefreshCw size={16} /> : <Sparkles size={16} />}
                                {isRebalanceMode ? 'Aplicar Trocas' : 'Aplicar na Escala'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação IA */}
            {showConfirmAI && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-secondary/10 to-secondary/20 rounded-full flex items-center justify-center text-secondary mb-4 shadow-sm">
                                <Sparkles size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Gerar Escala Automática?</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                                A Inteligência Artificial vai analisar a disponibilidade, regras de conflito e observações dos membros para preencher as posições <strong>vazias</strong> da escala deste mês.
                                <br/><br/>
                                Posições já preenchidas <strong>não serão alteradas</strong>. Deseja continuar?
                            </p>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                            <button 
                                onClick={() => setShowConfirmAI(false)}
                                className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleGenerateAI}
                                className="px-6 py-2 bg-gradient-to-r from-secondary to-secondaryHover hover:from-secondaryHover hover:to-secondary text-white text-sm font-bold rounded-xl shadow-lg shadow-secondary/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Sparkles size={16} />
                                Gerar Escala
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Reequilíbrio */}
            {showConfirmRebalance && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 mb-4 shadow-sm">
                                <RefreshCw size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Reequilibrar Escala?</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                                A IA vai analisar a distribuição atual do mês e sugerir <strong>trocas</strong> para equilibrar a carga entre os membros, sem sobrecarregar ninguém.
                                <br/><br/>
                                Você revisará cada troca antes de aplicar. Membros já escalados <strong>poderão ser substituídos</strong> por outros com menos escalas no mês.
                            </p>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                            <button 
                                onClick={() => setShowConfirmRebalance(false)}
                                className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleRebalanceAI}
                                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Analisar e Equilibrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAlertsList && detailedAlerts.length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                                <AlertCircle size={24} className="text-red-500" />
                                Alertas na Escala
                            </h3>
                            <button 
                                onClick={() => setShowAlertsList(false)}
                                className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {detailedAlerts.map((alert, i) => (
                                <div key={i} className="flex flex-col p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 gap-1 relative overflow-hidden group">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
                                            <span className="font-bold text-sm text-red-700 dark:text-red-400">
                                                {alert.memberName}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setShowAlertsList(false);
                                                setTimeout(() => {
                                                    const elements = document.querySelectorAll(`[id="cell-${alert.date}-${alert.role}"]`);
                                                    for (const el of Array.from(elements)) {
                                                        if (window.getComputedStyle(el).display !== 'none') {
                                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            el.classList.add('ring-4', 'ring-red-500', 'transition-all', 'rounded-xl');
                                                            setTimeout(() => el.classList.remove('ring-4', 'ring-red-500', 'rounded-xl'), 3000);
                                                            break;
                                                        }
                                                    }
                                                }, 100);
                                            }}
                                            className="text-[10px] font-bold bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <Search size={12} />
                                            Ver Local
                                        </button>
                                    </div>
                                    <div className="text-xs text-zinc-600 dark:text-zinc-400 pl-3 border-l-2 border-red-200 dark:border-red-800/50 ml-0.5">
                                        <p><strong>Motivo:</strong> {alert.message}</p>
                                        <p><strong>Data:</strong> {alert.date.split('-').reverse().join('/')} ({alert.time})</p>
                                        <p><strong>Evento:</strong> {alert.eventTitle}</p>
                                        <p><strong>Função:</strong> {alert.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                            <button 
                                onClick={() => setShowAlertsList(false)}
                                className="px-6 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-bold rounded-xl transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Estilos Globais para Scrollbar */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e4e4e7;
                    border-radius: 3px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #3f3f46;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #d4d4d8;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #52525b;
                }
            `}</style>
        </div>
    );
};
