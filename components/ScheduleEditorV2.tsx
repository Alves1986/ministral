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
    fetchGlobalConflictsV2,
    togglePublishScheduleV2,
    replaceChoirAssignmentsV2
} from '../services/scheduleServiceV2';
import { sendNotificationSQL } from '../services/supabaseService';
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
    AlertCircle,
    Bell,
    Send,
    Mic
} from 'lucide-react';
import { useToast } from './Toast';
import { generateAISchedule } from '../services/aiScheduleService';
import { validateAssignment } from '../services/aiScheduleUtils';

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
    onOpenChoir?: () => void;
}>(({ occurrence, role, members, onAssign, onConfirm, processing, availability, conflictRules, assignments, memberCounts, globalConflicts, allOccurrences, onOpenChoir }) => {
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
            onOpenChoir={onOpenChoir}
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
    if (prev.onOpenChoir !== next.onOpenChoir) return false;

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
    onOpenClearModal?: () => void;
}

export const ScheduleEditorV2: React.FC<Props> = ({ 
    ministryId, 
    orgId, 
    currentMonth, 
    onMonthChange, 
    currentTab, 
    isAdmin, 
    isPro, 
    roles,
    onOpenClearModal
}) => {
    const { addToast, confirmAction } = useToast();
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
    const [selectedAiIndices, setSelectedAiIndices] = useState<number[]>([]);
    const [showAlertsList, setShowAlertsList] = useState(false);
    const [choirOccurrence, setChoirOccurrence] = useState<OccurrenceV2 | null>(null);
    const [selectedChoirMembers, setSelectedChoirMembers] = useState<string[]>([]);
    const [choirSearchTerm, setChoirSearchTerm] = useState('');

    const toggleSelectAiSuggestion = (index: number) => {
        setSelectedAiIndices(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index) 
                : [...prev, index]
        );
    };

    const handleSelectAllAiSuggestions = () => {
        if (selectedAiIndices.length === aiSuggestions.length) {
            setSelectedAiIndices([]);
        } else {
            setSelectedAiIndices(aiSuggestions.map((_, i) => i));
        }
    };

    const handleCloseReviewAI = () => {
        setShowReviewAI(false);
        setIsRebalanceMode(false);
        setAiSuggestions([]);
        setSelectedAiIndices([]);
    };
    
    const reviewModalRef = useRef<HTMLDivElement>(null);
    const confirmAIModalRef = useRef<HTMLDivElement>(null);
    const confirmRebalanceModalRef = useRef<HTMLDivElement>(null);
    const alertsModalRef = useRef<HTMLDivElement>(null);
    const choirModalRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    // Get the currently active modal ref
    const activeModalRef = showReviewAI ? reviewModalRef : showConfirmAI ? confirmAIModalRef : showConfirmRebalance ? confirmRebalanceModalRef : showAlertsList ? alertsModalRef : choirOccurrence ? choirModalRef : null;
    const isAnyModalOpen = showReviewAI || showConfirmAI || showConfirmRebalance || showAlertsList || Boolean(choirOccurrence);

    useEffect(() => {
        if (isAnyModalOpen) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            setTimeout(() => activeModalRef?.current?.focus(), 0);
        } else if (previousFocusRef.current) {
            previousFocusRef.current.focus();
        }
    }, [isAnyModalOpen, activeModalRef]);

    useEffect(() => {
        if (!isAnyModalOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showReviewAI) handleCloseReviewAI();
                else if (showConfirmAI) setShowConfirmAI(false);
                else if (showConfirmRebalance) setShowConfirmRebalance(false);
                else if (showAlertsList) setShowAlertsList(false);
                else if (choirOccurrence) setChoirOccurrence(null);
                return;
            }
            if (e.key === 'Tab' && activeModalRef?.current) {
                const focusable = activeModalRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
                } else {
                    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isAnyModalOpen, showReviewAI, showConfirmAI, showConfirmRebalance, showAlertsList, activeModalRef]);
    
    const [members, setMembers] = useState<MemberV2[]>([]);
    const [assignments, setAssignments] = useState<AssignmentV2[]>([]);
    const [occurrences, setOccurrences] = useState<OccurrenceV2[]>([]);
    const [availability, setAvailability] = useState<Record<string, Record<string, string>>>({});
    const [memberNotes, setMemberNotes] = useState<Record<string, string>>({});
    const [conflictRules, setConflictRules] = useState<{ blockGroups: string[][], allowExceptions: string[][], memberBlocks: string[][], memberPrefers: string[][], eventRoleExcludes: Record<string, string[]> }>({ blockGroups: [], allowExceptions: [], memberBlocks: [], memberPrefers: [], eventRoleExcludes: {} });
    const [globalConflicts, setGlobalConflicts] = useState<Record<string, { date: string, ministryId: string, role: string }[]>>({});
    const [isPublishing, setIsPublishing] = useState(false);

    // Verifica se a escala do mês está liberada/publicada
    const isMonthPublished = useMemo(() => {
        return assignments.some(a => 
            a.role === '__PUBLISHED__' &&
            a.event_date.startsWith(currentMonth)
        );
    }, [assignments, currentMonth]);

    // -- DRAG TO SCROLL (Navegação arrastando com o mouse na tabela) --
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const isMouseDownRef = useRef(false);
    const hasMovedRef = useRef(false);
    const startXRef = useRef(0);
    const scrollLeftRef = useRef(0);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // Apenas botão esquerdo
        const target = e.target as HTMLElement;
        // Não iniciar drag se clicou em inputs, selects, dropdowns abertos ou diálogos
        if (target.closest('input, textarea, select, .z-\\[9999\\], [role="dialog"]')) return;

        isMouseDownRef.current = true;
        hasMovedRef.current = false;
        startXRef.current = e.pageX - (tableContainerRef.current?.offsetLeft || 0);
        scrollLeftRef.current = tableContainerRef.current?.scrollLeft || 0;
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isMouseDownRef.current || !tableContainerRef.current) return;
        const x = e.pageX - (tableContainerRef.current.offsetLeft || 0);
        const walk = x - startXRef.current;

        if (Math.abs(walk) > 4) {
            if (!hasMovedRef.current) {
                hasMovedRef.current = true;
                setIsDragging(true);
            }
            tableContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
        }
    };

    const handleMouseUpOrLeave = () => {
        isMouseDownRef.current = false;
        if (hasMovedRef.current) {
            setTimeout(() => {
                hasMovedRef.current = false;
                setIsDragging(false);
            }, 60);
        } else {
            setIsDragging(false);
        }
    };

    const handleClickCapture = (e: React.MouseEvent) => {
        // Se arrastou, impede que o clique abra o dropdown da célula
        if (hasMovedRef.current) {
            e.stopPropagation();
            e.preventDefault();
        }
    };

    // -- DERIVED STATE --
    // O Coral é especial (Ceia) e não pesa no equilíbrio de escalas do mês
    const memberCounts = assignments.reduce((acc, curr) => {
        if (curr.member_id && curr.role !== '__EVENT_EXCLUDED__' && curr.role !== '__PUBLISHED__' && !curr.role.toLowerCase().startsWith('coral')) {
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
            
            // Validar sugestões contra regras de negócio absolutas
            const validAi = safeAi.filter((a: any) => {
                const err = validateAssignment(a, input);
                if (err) {
                    console.warn(`Sugestão da IA rejeitada: [${a.event_date}] ${a.role} -> ${a.member_id}. Motivo: ${err.message}`);
                    return false;
                }
                return true;
            });

            // Filtrar apenas o que NÃO está preenchido
            const newAssignments = validAi.filter((ai: any) => {
                const alreadyExists = assignments.some(a => 
                    a.event_date && typeof a.event_date === 'string' &&
                    a.event_date.slice(0, 10) === ai.event_date.slice(0, 10) && 
                    a.role === ai.role && 
                    a.event_rule_id === ai.event_rule_id
                );
                return !alreadyExists;
            });

            if (newAssignments.length === 0) {
                addToast(
                    aiAssignments.length === 0
                        ? 'Nenhuma nova vaga pôde ser preenchida (a escala pode já estar completa ou não há membros disponíveis para as vagas restantes).'
                        : 'Todas as sugestões geradas já estão preenchidas na escala.',
                    'info'
                );
                setIsGeneratingAI(false);
                return;
            }

            setAiSuggestions(newAssignments);
            setSelectedAiIndices(newAssignments.map((_, i) => i));
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
        const itemsToApply = aiSuggestions.filter((_, idx) => selectedAiIndices.includes(idx));
        if (itemsToApply.length === 0) return;

        setProcessing(true);
        setShowReviewAI(false);
        try {
            for (const item of itemsToApply) {
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
            const label = isRebalanceMode 
                ? `${itemsToApply.length} ${itemsToApply.length === 1 ? 'troca de equilíbrio aplicada' : 'trocas de equilíbrio aplicadas'}`
                : `${itemsToApply.length} ${itemsToApply.length === 1 ? 'atribuição aplicada' : 'atribuições aplicadas'}`;
            addToast(`${label} com sucesso!`, 'success');
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
            setSelectedAiIndices([]);
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
                
            const validAi = safeAi.filter((a: any) => {
                const err = validateAssignment(a, input);
                if (err) {
                    console.warn(`Sugestão da IA (Reequilíbrio) rejeitada: [${a.event_date}] ${a.role} -> ${a.member_id}. Motivo: ${err.message}`);
                    return false;
                }
                return true;
            });

            if (validAi.length === 0) {
                addToast('A escala já está bem equilibrada e sem vagas pendentes para preencher.', 'info');
                return;
            }
            setAiSuggestions(validAi);
            setSelectedAiIndices(validAi.map((_, i) => i));
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

    const handleOpenChoirModal = useCallback((occ: OccurrenceV2) => {
        setChoirOccurrence(occ);
        setChoirSearchTerm('');

        // Identifica todos os membros com função Vocal
        const vocalMembers = members.filter(m => {
            return (m.ministry_functions || []).some(f => {
                const norm = f.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return norm === 'vocal';
            });
        });

        // Verifica se já existem membros no coral deste evento
        const existingChoir = assignments.filter(a => 
            a.event_date?.slice(0, 10) === occ.date.slice(0, 10) &&
            a.event_rule_id === occ.ruleId &&
            a.role.toLowerCase().startsWith('coral') &&
            a.member_id
        );

        if (existingChoir.length > 0) {
            setSelectedChoirMembers(existingChoir.map(a => a.member_id));
        } else {
            // Regra A1: Abre a lista com todos os vocais marcados para o usuário desmarcar quem não puder ir
            setSelectedChoirMembers(vocalMembers.map(m => m.id));
        }
    }, [members, assignments]);

    const handleSaveChoir = async (memberIdsToSave: string[]) => {
        if (!choirOccurrence) return;
        setProcessing(true);
        try {
            // Identifica todas as vagas de Vocal e Coral deste evento para substituição limpa (Regra A2)
            const rolesToRemove = assignments
                .filter(a => 
                    a.event_date?.slice(0, 10) === choirOccurrence.date.slice(0, 10) &&
                    a.event_rule_id === choirOccurrence.ruleId &&
                    (a.role.toLowerCase().startsWith('vocal') || a.role.toLowerCase().startsWith('coral'))
                )
                .map(a => a.role);

            // Garante que os papéis de Vocal padrão da escala também sejam incluídos na limpeza
            roles.forEach(r => {
                if (r.toLowerCase().startsWith('vocal') && !rolesToRemove.includes(r)) {
                    rolesToRemove.push(r);
                }
            });

            await replaceChoirAssignmentsV2(ministryId, orgId, {
                event_rule_id: choirOccurrence.ruleId,
                event_date: choirOccurrence.date,
                rolesToRemove: Array.from(new Set(rolesToRemove)),
                memberIds: memberIdsToSave
            });

            if (memberIdsToSave.length > 0) {
                addToast(`Coral com ${memberIdsToSave.length} membros escalado com sucesso!`, 'success');
            } else {
                addToast('Coral removido da escala.', 'info');
            }

            queryClient.invalidateQueries({ queryKey: ['assignments', ministryId, currentMonth, orgId] });
            queryClient.invalidateQueries({ queryKey: ['nextEvent', ministryId, orgId] });
            queryClient.invalidateQueries({ queryKey: ['conflicts', ministryId, currentMonth, orgId] });
            await loadData();
        } catch (err: any) {
            console.error('Erro ao salvar coral:', err);
            addToast('Erro ao salvar escala do coral', 'error');
        } finally {
            setProcessing(false);
            setChoirOccurrence(null);
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

                // Sem notificação aqui: o membro só é avisado quando a escala do mês
                // for liberada (handlePublishMonth) e no próprio dia (push-reminders).
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
        confirmAction(
            "Excluir Evento do Mês",
            `Deseja realmente excluir o evento "${occ.title}" do dia ${occ.date.split('-').reverse().join('/')}? Esta ação afetará apenas este mês.`,
            async () => {
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
            }
        );
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

    // Alternar liberação da escala do mês e notificar todos os membros
    const handlePublishMonth = async () => {
        setIsPublishing(true);
        const newStatus = !isMonthPublished;
        try {
            const fallbackRuleId = occurrences[0]?.ruleId || assignments.find(a => a.event_rule_id && a.event_rule_id !== 'PUBLISHED_FLAG')?.event_rule_id;
            await togglePublishScheduleV2(ministryId, orgId, currentMonth, newStatus, fallbackRuleId);
            if (newStatus) {
                // Notifica individualmente cada membro escalado no mês, listando seus dias
                const byMember = new Map<string, string[]>();
                assignments
                    .filter(a =>
                        a.member_id &&
                        a.event_date?.startsWith(currentMonth) &&
                        a.role !== '__EVENT_EXCLUDED__' &&
                        a.role !== '__PUBLISHED__' &&
                        a.event_rule_id !== 'PUBLISHED_FLAG'
                    )
                    .sort((a, b) => a.event_date.localeCompare(b.event_date))
                    .forEach(a => {
                        const occurrence = occurrences.find(o => o.date === a.event_date && o.ruleId === a.event_rule_id);
                        const [, mm, dd] = a.event_date.split('-');
                        const cleanRole = a.role.toLowerCase().startsWith('coral') ? 'Coral' : a.role;
                        const label = `${dd}/${mm}${occurrence?.title ? ` - ${occurrence.title}` : ''} (${cleanRole})`;
                        const list = byMember.get(a.member_id as string) || [];
                        list.push(label);
                        byMember.set(a.member_id as string, list);
                    });

                await Promise.all(Array.from(byMember.entries()).map(([memberId, items]) => {
                    const member = members.find(m => m.id === memberId);
                    return sendNotificationSQL(ministryId, orgId, {
                        title: `📅 Escala de ${monthLabel} liberada`,
                        message: `${member?.name || 'Membro'}, a escala de ${monthLabel} está liberada! Você está escalado(a) em: ${items.join('; ')}.`,
                        type: 'success',
                        actionLink: 'history',
                        targetUserId: memberId
                    }).catch(() => {});
                }));
                addToast(`Escala de ${monthLabel} liberada! ${byMember.size} membro(s) notificado(s).`, 'success');
            } else {
                addToast(`Escala de ${monthLabel} em modo rascunho (oculta do calendário).`, 'info');
            }
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            queryClient.invalidateQueries({ queryKey: ['nextEvent', ministryId, orgId] });
            await loadData();
        } catch (error: any) {
            console.error('Erro ao alternar publicação da escala:', error);
            addToast(error?.message || 'Erro ao atualizar status da escala.', 'error');
        } finally {
            setIsPublishing(false);
        }
    };

    // Notificar membros escalados hoje para marcar presença
    const handleRemindToday = async () => {
        const todayIso = new Date().toISOString().split('T')[0];
        const todayAssignments = assignments.filter(a => 
            a.event_date === todayIso && 
            a.role !== '__EVENT_EXCLUDED__' && 
            a.event_rule_id !== 'PUBLISHED_FLAG' && 
            a.role !== '__PUBLISHED__' && 
            a.member_id
        );

        if (todayAssignments.length === 0) {
            addToast('Nenhum membro escalado para hoje nesta escala.', 'info');
            return;
        }

        try {
            const notifiedMembers = new Set<string>();
            for (const a of todayAssignments) {
                if (!a.member_id || notifiedMembers.has(a.member_id)) continue;
                notifiedMembers.add(a.member_id);
                const member = members.find(m => m.id === a.member_id);
                const occurrence = occurrences.find(o => o.date === a.event_date && o.ruleId === a.event_rule_id);
                const eventTitle = occurrence?.title || 'Culto de Hoje';
                
                await sendNotificationSQL(ministryId, orgId, {
                    title: '🔔 Hoje é seu dia de escala!',
                    message: `Olá ${member?.name || 'Membro'}, você está escalado(a) hoje em "${eventTitle}" (${a.role}). Por favor, confirme sua presença no app!`,
                    type: 'warning',
                    actionLink: 'dashboard',
                    targetUserId: a.member_id
                }).catch(() => {});
            }
            addToast(`Lembrete de presença enviado para ${notifiedMembers.size} membro(s) escalado(s) hoje!`, 'success');
        } catch (error) {
            console.error('Erro ao enviar lembretes:', error);
            addToast('Erro ao enviar lembretes de escala para hoje.', 'error');
        }
    };

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
        <div className="flex flex-col w-full">
            {/* BARRA SUPERIOR DE CONTROLES (ESTÁTICA, ROLA NATURALMENTE COM A PÁGINA) */}
            <div className="bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md py-3.5 px-3 sm:px-5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-sm mb-6 -mx-3 sm:-mx-5 lg:-mx-6">
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
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
                            <button
                                onClick={handlePublishMonth}
                                disabled={isPublishing}
                                className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-md ${
                                    isMonthPublished 
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' 
                                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60'
                                }`}
                                title={isMonthPublished ? "Escala publicada (clique para ocultar)" : "Publicar e notificar membros sobre a escala deste mês"}
                            >
                                <Send size={15} />
                                <span>{isMonthPublished ? 'Escala Liberada' : 'Liberar Escala'}</span>
                            </button>

                            <button
                                onClick={handleRemindToday}
                                title="Notificar membros escalados hoje para marcar presença no app"
                                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-md bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
                            >
                                <Bell size={15} />
                                <span>Lembrar Hoje</span>
                            </button>

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
                            {isPro && (
                                <button
                                    onClick={() => setShowConfirmRebalance(true)}
                                    disabled={isGeneratingAI}
                                    title="Preencher vagas vazias e equilibrar as escalas do mês"
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-lg bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 disabled:opacity-60"
                                >
                                    <RefreshCw size={16} />
                                    Equilibrar
                                </button>
                            )}

                            {onOpenClearModal && (
                                <button
                                    onClick={onOpenClearModal}
                                    title="Limpar escala completa ou parcialmente por função (Vocal, Ministros, etc.)"
                                    className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-sm bg-zinc-100 hover:bg-red-50 dark:bg-zinc-800 dark:hover:bg-red-950/30 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 border border-zinc-200 dark:border-zinc-700 hover:border-red-300 dark:hover:border-red-800"
                                >
                                    <Trash2 size={15} />
                                    <span>Limpar</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* AREA DA TABELA COM NAVEGAÇÃO ARRASTANDO (DRAG-TO-SCROLL) */}
            <div 
                ref={tableContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onClickCapture={handleClickCapture}
                className="w-full pb-16 md:pb-0"
            > 
                {/* Desktop View (Table) */}
                <div className="hidden md:block">
                    <table className="w-full table-fixed text-sm border-separate border-spacing-0">
                        <thead className="bg-zinc-100 dark:bg-zinc-800/80">
                            <tr>
                                <th className="p-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 w-[120px] bg-zinc-100 dark:bg-zinc-900 border-b border-r border-zinc-200 dark:border-zinc-800">
                                    Data / Evento
                                </th>
                                {roles.map(role => (
                                    <th key={role} title={role} className="px-1.5 py-2 text-center text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 truncate bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                        {role.toUpperCase()}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="">
                            {visibleOccurrences.map((occurrence: OccurrenceV2) => (
                                <tr key={`${occurrence.date}-${occurrence.time}-${occurrence.ruleId}`} className="group hover:bg-zinc-100/60 dark:hover:bg-zinc-800/30 even:bg-zinc-50/50 dark:even:bg-zinc-900/30">
                                    {/* Coluna Fixa de Data */}
                                    <td className="p-2 bg-white dark:bg-slate-950 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-900 border-b border-r border-zinc-200 dark:border-zinc-800">
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
                                        const occChoir = assignments.filter(a => 
                                            a.event_date?.slice(0, 10) === occurrence.date.slice(0, 10) && 
                                            a.event_rule_id === occurrence.ruleId && 
                                            a.role.toLowerCase().startsWith('coral') && 
                                            a.member_id
                                        );
                                        const isVocalRole = role.toLowerCase().startsWith('vocal');
                                        const firstVocalRole = roles.find(r => r.toLowerCase().startsWith('vocal'));

                                        if (occChoir.length > 0 && isVocalRole) {
                                            if (role === firstVocalRole) {
                                                return (
                                                    <td id={`cell-${occurrence.date}-${role}`} key={`${occurrence.date}-${role}`} className="px-0.5 py-1.5 relative border-b border-zinc-100 dark:border-zinc-800/50 min-w-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenChoirModal(occurrence)}
                                                            className="w-full h-full min-h-[42px] px-2 py-1 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/10 dark:from-purple-900/30 dark:to-amber-900/30 border-2 border-purple-400 dark:border-purple-600 rounded-xl flex items-center justify-between text-left hover:border-purple-500 transition-all shadow-sm group"
                                                            title="Clique para ver ou editar membros do Coral da Ceia"
                                                        >
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <div className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] shrink-0 font-black">
                                                                    🎤
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[11px] font-black text-purple-700 dark:text-purple-300 truncate">
                                                                        Coral Ceia
                                                                    </span>
                                                                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-bold truncate">
                                                                        {occChoir.length} {occChoir.length === 1 ? 'membro' : 'membros'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 shrink-0">
                                                                Editar
                                                            </span>
                                                        </button>
                                                    </td>
                                                );
                                            }
                                            return (
                                                <td id={`cell-${occurrence.date}-${role}`} key={`${occurrence.date}-${role}`} className="px-0.5 py-1.5 relative border-b border-zinc-100 dark:border-zinc-800/50 min-w-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenChoirModal(occurrence)}
                                                        className="w-full h-full min-h-[42px] px-1 py-1 bg-zinc-50 dark:bg-zinc-800/40 border border-dashed border-purple-300 dark:border-purple-800/60 rounded-xl flex items-center justify-center text-center opacity-70 hover:opacity-100 transition-opacity"
                                                        title="Integrado ao Coral da Ceia. Clique para gerenciar."
                                                    >
                                                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold truncate">
                                                            Em Coral 🎤
                                                        </span>
                                                    </button>
                                                </td>
                                            );
                                        }

                                        return (
                                            <td id={`cell-${occurrence.date}-${role}`} key={`${occurrence.date}-${role}`} className="px-0.5 py-1.5 relative border-b border-zinc-100 dark:border-zinc-800/50 min-w-0">
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
                                                    onOpenChoir={() => handleOpenChoirModal(occurrence)}
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
                                        const occChoir = assignments.filter(a => 
                                            a.event_date?.slice(0, 10) === occurrence.date.slice(0, 10) && 
                                            a.event_rule_id === occurrence.ruleId && 
                                            a.role.toLowerCase().startsWith('coral') && 
                                            a.member_id
                                        );
                                        const isVocalRole = role.toLowerCase().startsWith('vocal');
                                        const firstVocalRole = roles.find(r => r.toLowerCase().startsWith('vocal'));

                                        if (occChoir.length > 0 && isVocalRole) {
                                            if (role === firstVocalRole) {
                                                return (
                                                    <div id={`cell-${occurrence.date}-${role}`} key={`${occurrence.date}-${role}`} className="flex flex-col gap-1.5">
                                                        <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">{role} • Coral</label>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenChoirModal(occurrence)}
                                                            className="w-full p-3 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/10 dark:from-purple-900/30 dark:to-amber-900/30 border-2 border-purple-400 dark:border-purple-600 rounded-xl flex items-center justify-between text-left hover:border-purple-500 transition-all shadow-sm"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-black">
                                                                    🎤
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-purple-700 dark:text-purple-300 text-sm">
                                                                        Coral da Ceia
                                                                    </div>
                                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                                                                        {occChoir.length} membros escalados
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-purple-500 text-white shadow-sm">
                                                                Gerenciar Coral
                                                            </span>
                                                        </button>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div id={`cell-${occurrence.date}-${role}`} key={`${occurrence.date}-${role}`} className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">{role}</label>
                                                    <div 
                                                        onClick={() => handleOpenChoirModal(occurrence)}
                                                        className="p-2.5 rounded-xl border border-dashed border-purple-300 dark:border-purple-800/60 bg-zinc-50 dark:bg-zinc-800/40 text-center cursor-pointer"
                                                    >
                                                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                                                            Integrado ao Coral da Ceia 🎤
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        }

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
                                                    onOpenChoir={() => handleOpenChoirModal(occurrence)}
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" role="presentation">
                    <div 
                        ref={reviewModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={isRebalanceMode ? "Revisar trocas de equilíbrio" : "Revisar sugestões da IA"}
                        tabIndex={-1}
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] outline-none"
                    >
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
                            <button onClick={handleCloseReviewAI} aria-label="Fechar" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Barra de Seleção Rápida */}
                        <div className="px-6 py-2.5 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between gap-4">
                            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                                <span className={`inline-block w-2 h-2 rounded-full ${isRebalanceMode ? 'bg-amber-500' : 'bg-secondary'}`} />
                                <span>
                                    <strong>{selectedAiIndices.length}</strong> de {aiSuggestions.length} {isRebalanceMode ? (aiSuggestions.length === 1 ? 'troca selecionada' : 'trocas selecionadas') : (aiSuggestions.length === 1 ? 'sugestão selecionada' : 'sugestões selecionadas')}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSelectAllAiSuggestions}
                                className="text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors"
                            >
                                {selectedAiIndices.length === aiSuggestions.length ? 'Desmarcar todas' : 'Selecionar todas'}
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
                                    const isSelected = selectedAiIndices.includes(i);

                                    return (
                                        <div 
                                            key={i} 
                                            role="checkbox"
                                            aria-checked={isSelected}
                                            tabIndex={0}
                                            onClick={() => toggleSelectAiSuggestion(i)}
                                            onKeyDown={(e) => {
                                                if (e.key === ' ' || e.key === 'Enter') {
                                                    e.preventDefault();
                                                    toggleSelectAiSuggestion(i);
                                                }
                                            }}
                                            className={`flex flex-col gap-2 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                                                isSelected
                                                    ? isRebalanceMode
                                                        ? 'bg-amber-500/[0.08] border-amber-500/60 dark:border-amber-500/50 shadow-sm ring-1 ring-amber-500/30'
                                                        : 'bg-secondary/[0.08] border-secondary/60 dark:border-secondary/50 shadow-sm ring-1 ring-secondary/30'
                                                    : 'bg-zinc-50/50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700/50 opacity-50 hover:opacity-85'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`flex flex-col items-center justify-center bg-white dark:bg-zinc-800 border rounded-lg w-10 h-10 shrink-0 shadow-sm transition-colors ${
                                                    isSelected 
                                                        ? (isRebalanceMode ? 'border-amber-500/40 text-amber-600 dark:text-amber-400' : 'border-secondary/40 text-secondary') 
                                                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-400'
                                                }`}>
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
                                                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5 truncate flex items-center gap-1">
                                                            <RefreshCw size={10} className="shrink-0" />
                                                            <span>⇔ substitui {replacedMember.name} ({replacedCount}x)</span>
                                                        </div>
                                                    )}
                                                    {isRebalanceMode && !item.replacedMemberId && (
                                                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 truncate flex items-center gap-1">
                                                            <Sparkles size={10} className="shrink-0" />
                                                            <span>Preenchendo vaga vazia</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                                                    isSelected
                                                        ? isRebalanceMode
                                                            ? 'bg-amber-500 text-white shadow-sm'
                                                            : 'bg-secondary text-white shadow-sm'
                                                        : 'border-2 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
                                                }`}>
                                                    {isSelected && <Check size={14} className="stroke-[3]" />}
                                                </div>
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
                                onClick={handleCloseReviewAI}
                                className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                            >
                                Descartar
                            </button>
                            <button 
                                onClick={handleApplyAISuggestions}
                                disabled={processing || selectedAiIndices.length === 0}
                                className={`px-6 py-2 text-white text-sm font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    isRebalanceMode
                                        ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                                        : 'bg-secondary hover:bg-secondaryHover shadow-secondary/20'
                                }`}
                            >
                                {processing ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : isRebalanceMode ? (
                                    <RefreshCw size={16} />
                                ) : (
                                    <Sparkles size={16} />
                                )}
                                {isRebalanceMode 
                                    ? `Aplicar Trocas (${selectedAiIndices.length})` 
                                    : `Aplicar na Escala (${selectedAiIndices.length})`
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação IA */}
            {showConfirmAI && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" role="presentation">
                    <div 
                        ref={confirmAIModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Confirmar geração de escala"
                        tabIndex={-1}
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
                    >
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" role="presentation">
                    <div 
                        ref={confirmRebalanceModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Confirmar reequilíbrio da escala"
                        tabIndex={-1}
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
                    >
                        <div className="p-6">
                            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 mb-4 shadow-sm">
                                <RefreshCw size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Equilibrar Escala?</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                                O sistema vai <strong>preencher as vagas vazias</strong> distribuindo igualmente as escalas entre os membros disponíveis e, se necessário, sugerir <strong>trocas</strong> para descarregar membros com excesso de escalas.
                                <br/><br/>
                                Você revisará cada vaga preenchida e troca antes de aplicar na escala. Deseja continuar?
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
                                Equilibrar Escala
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAlertsList && detailedAlerts.length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="presentation">
                    <div 
                        ref={alertsModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Alertas na escala"
                        tabIndex={-1}
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[80vh] outline-none"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                                <AlertCircle size={24} className="text-red-500" />
                                Alertas na Escala
                            </h3>
                            <button 
                                onClick={() => setShowAlertsList(false)}
                                aria-label="Fechar"
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

            {/* Modal do Coral da Ceia (Todos os Vocais) */}
            {choirOccurrence && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" role="presentation">
                    <div 
                        ref={choirModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Escalar Coral da Ceia"
                        tabIndex={-1}
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] outline-none"
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black">
                                    <Mic size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-zinc-900 dark:text-white leading-tight">
                                        Coral da Ceia — Todos os Vocais
                                    </h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                                        {new Date(`${choirOccurrence.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} • {choirOccurrence.title}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setChoirOccurrence(null)} 
                                aria-label="Fechar" 
                                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Subheader info & quick controls */}
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-3">
                            <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 rounded-xl p-3">
                                <strong>Dia de Santa Ceia:</strong> Todos os vocais selecionados serão escalados juntos no Coral. As vagas individuais de Vocal deste culto serão substituídas pelo Coral e essa escala especial não pesará no equilíbrio de escalas normais do mês.
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <div className="relative flex-1">
                                    <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar vocais..."
                                        className="w-full bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 text-xs rounded-lg py-2 pl-8 pr-3 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-zinc-200 dark:border-zinc-800 placeholder:text-zinc-400"
                                        value={choirSearchTerm}
                                        onChange={(e) => setChoirSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const allVocalIds = members.filter(m => (m.ministry_functions || []).some(f => f.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 'vocal')).map(m => m.id);
                                            setSelectedChoirMembers(allVocalIds);
                                        }}
                                        className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-2 py-1.5 rounded-lg transition-colors"
                                    >
                                        Marcar Todos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedChoirMembers([])}
                                        className="text-[11px] font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1.5 rounded-lg transition-colors"
                                    >
                                        Desmarcar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Members list */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                            {(() => {
                                const vocalMembers = members.filter(m => {
                                    const isVocal = (m.ministry_functions || []).some(f => {
                                        const norm = f.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                        return norm === 'vocal';
                                    });
                                    if (!isVocal) return false;
                                    if (choirSearchTerm && !m.name.toLowerCase().includes(choirSearchTerm.toLowerCase())) {
                                        return false;
                                    }
                                    return true;
                                });

                                if (vocalMembers.length === 0) {
                                    return (
                                        <div className="py-8 text-center text-zinc-400 text-xs">
                                            Nenhum membro com função Vocal encontrado.
                                        </div>
                                    );
                                }

                                return vocalMembers.map(member => {
                                    const isSelected = selectedChoirMembers.includes(member.id);
                                    const availStatus = getMemberAvailStatus(member.id, choirOccurrence.date, choirOccurrence.time, availability);
                                    const isUnavailable = availStatus === 'unavailable';

                                    return (
                                        <div
                                            key={member.id}
                                            onClick={() => {
                                                setSelectedChoirMembers(prev => 
                                                    prev.includes(member.id) 
                                                        ? prev.filter(id => id !== member.id)
                                                        : [...prev, member.id]
                                                );
                                            }}
                                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                                isSelected
                                                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700/60 shadow-sm'
                                                    : 'bg-white dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                                                    isSelected 
                                                        ? 'bg-purple-600 border-purple-600 text-white' 
                                                        : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
                                                }`}>
                                                    {isSelected && <Check size={14} className="stroke-[3]" />}
                                                </div>
                                                <Avatar name={member.name} avatarUrl={member.avatar_url} size="sm" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                                        {member.name}
                                                    </span>
                                                    {isUnavailable && (
                                                        <span className="text-[10px] text-red-500 font-bold">
                                                            Indisponível neste dia
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="shrink-0 flex items-center gap-1.5">
                                                {isUnavailable ? (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                                        Ausência marcada
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                                        Disponível
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800">
                            {/* Se já existia coral escalado, botão para desfazer/remover */}
                            {assignments.some(a => a.event_date?.slice(0, 10) === choirOccurrence.date.slice(0, 10) && a.event_rule_id === choirOccurrence.ruleId && a.role.toLowerCase().startsWith('coral') && a.member_id) ? (
                                <button
                                    type="button"
                                    onClick={() => handleSaveChoir([])}
                                    disabled={processing}
                                    className="px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors flex items-center gap-1.5"
                                >
                                    <Trash2 size={14} />
                                    Remover Coral
                                </button>
                            ) : (
                                <div></div>
                            )}

                            <div className="flex items-center gap-2">
                                <button 
                                    type="button"
                                    onClick={() => setChoirOccurrence(null)}
                                    disabled={processing}
                                    className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleSaveChoir(selectedChoirMembers)}
                                    disabled={processing}
                                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/25 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70"
                                >
                                    {processing ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                                    Confirmar Coral ({selectedChoirMembers.length})
                                </button>
                            </div>
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
