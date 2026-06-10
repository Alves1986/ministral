import React, { useState, useEffect, useRef } from 'react';
import { 
    User, 
    ChevronDown, 
    Check, 
    Trash2, 
    AlertTriangle, 
    Lock, 
    Search, 
    X 
} from 'lucide-react';
import { MemberV2, OccurrenceV2, AssignmentV2 } from '../services/scheduleServiceV2';

// --- AUXILIARY COMPONENTS ---

export const Avatar = ({ name, color, avatarUrl, size = 'sm' }:
 { name: string; color?: string; avatarUrl?: string; size?: 'sm' | 'md' }) => {
 const initials = name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
 const bgColors = ['bg-secondary','bg-secondaryHover','bg-accent','bg-primary',
   'bg-slate-500','bg-slate-600','bg-slate-700','bg-slate-800','bg-slate-900',
   'bg-zinc-500','bg-zinc-600','bg-zinc-700'];
 const safeColor = color || bgColors[name.length % bgColors.length];
 const dim = size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]';
 
 if (avatarUrl) {
   return (
     <img
       src={avatarUrl}
       alt={name}
       className={`${dim} rounded-full object-cover flex-shrink-0 border border-white/20`}
       onError={(e) => { e.currentTarget.style.display='none'; }}
       referrerPolicy="no-referrer"
     />
   );
 }
 return (
   <div className={`${dim} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${safeColor}`}>
     {initials}
   </div>
 );
};

// --- AVAILABILITY HELPERS ---

export const getMemberAvailStatus = (
    memberId: string,
    date: string,
    eventTime: string,
    availability: Record<string, Record<string, string>>
): 'available' | 'unavailable' => {
    const monthKey = `${date.substring(0, 7)}-01`;
    if (availability[memberId]?.[monthKey] === 'BLK') {
        return 'unavailable'; // Mês inteiro bloqueado
    }

    const memberAvail = availability[memberId]?.[date];
    // Se não marcou disponibilidade para o dia
    if (!memberAvail) return 'unavailable'; 
    
    // Se marcou que não pode, entao 'unavailable'
    if (memberAvail === 'unavailable') return 'unavailable';

    if (memberAvail === 'all') return 'available'; // dia todo: disponivel sempre
    
    // Verificar se e domingo (0 = domingo)
    const weekday = new Date(date + 'T12:00:00').getDay();
    if (weekday !== 0 && memberAvail !== 'BLK') return 'available'; // nao e domingo: qualquer nota = disponivel
    
    // Domingo: cruzar periodo marcado com horario do evento
    const hour = parseInt(eventTime.split(':')[0], 10);
    const eventPeriod = hour < 12 ? 'M' : 'N'; // manha ou noite
    return memberAvail === eventPeriod ? 'available' : 'unavailable';
};

export const isConflict = (
    memberId: string,
    targetRole: string,
    eventRuleId: string,
    eventDate: string,
    currentAssignments: AssignmentV2[],
    rules: { blockGroups: string[][], allowExceptions: string[][], memberBlocks: string[][], memberPrefers: string[][] },
    globalConflicts: Record<string, { date: string, ministryId: string, role: string }[]> = {},
    allOccurrences: OccurrenceV2[] = [],
    eventTime: string = ''
) => {
    // 0. Check Global Conflicts (Cross-Ministry)
    const crossMinistryEvents = globalConflicts[memberId]?.filter(c => c.date === eventDate);
    if (crossMinistryEvents && crossMinistryEvents.length > 0) {
        return { conflict: true, existingRole: 'Outro Ministério', type: 'global' };
    }

    // 1. Check Role Conflicts for the SAME member
    const memberRolesInEvent = currentAssignments
        .filter(a => a.member_id === memberId && a.event_rule_id === eventRuleId && a.event_date === eventDate)
        .map(a => a.role);
        
    const targetBaseRole = targetRole.replace(/\s\d+$/, '');
        
    for (const role of memberRolesInEvent) {
        const baseRole = role.replace(/\s\d+$/, '');
        
        if (baseRole === targetBaseRole) {
            return { conflict: true, existingRole: role, type: 'role' };
        }
        
        const inSameBlockGroup = rules.blockGroups.some(group => group.includes(targetBaseRole) && group.includes(baseRole));
        
        if (inSameBlockGroup) {
            const hasException = rules.allowExceptions.some(exc => 
                (exc.includes(targetBaseRole) && exc.includes(baseRole))
            );
            
            if (!hasException) {
                return { conflict: true, existingRole: role, type: 'group' };
            }
        }
    }

    // 2. Check Member Conflicts (Different members who cannot be together)
    const otherMemberIdsInEvent = currentAssignments
        .filter(a => a.event_rule_id === eventRuleId && a.event_date === eventDate && a.member_id !== memberId)
        .map(a => a.member_id);

    for (const otherId of otherMemberIdsInEvent) {
        const isBlocked = rules.memberBlocks.some(block => block.includes(memberId) && block.includes(otherId));
        if (isBlocked) {
            return { conflict: true, existingRole: 'Bloqueio de Membro', type: 'member' };
        }
    }

    // 3. Check Sunday Turn Conflict (Morning vs Evening)
    const dateObj = new Date(eventDate + 'T12:00:00');
    if (dateObj.getDay() === 0 && eventTime) {
        const hour = parseInt(eventTime.split(':')[0], 10);
        const isMorning = hour < 12;

        const otherAssignmentsThisDay = currentAssignments.filter(a => 
            a.member_id === memberId && 
            a.event_date === eventDate && 
            a.event_rule_id !== eventRuleId
        );

        for (const oAssign of otherAssignmentsThisDay) {
            const matchingOcc = allOccurrences.find(occ => occ.ruleId === oAssign.event_rule_id && occ.date === eventDate);
            if (matchingOcc) {
                const assignedHour = parseInt(matchingOcc.time.split(':')[0], 10);
                const assignedMorning = assignedHour < 12;
                if (isMorning !== assignedMorning) {
                    return { conflict: true, existingRole: 'Culto Diferente', type: 'sundayTurn' };
                }
            }
        }
    }
    
    return { conflict: false };
};

export interface ScheduleCellProps {
    occurrence: OccurrenceV2;
    role: string;
    currentMemberId: string | null;
    isConfirmed?: boolean;
    members: MemberV2[];
    onAssign: (date: string, role: string, memberId: string | null, ruleId: string) => void;
    onConfirm?: (date: string, role: string, ruleId: string) => void;
    processing: boolean;
    availability: Record<string, Record<string, string>>;
    eventTime: string;
    conflictRules: { blockGroups: string[][], allowExceptions: string[][], memberBlocks: string[][], memberPrefers: string[][] };
    assignments: AssignmentV2[];
    memberCounts: Record<string, number>;
    globalConflicts: Record<string, { date: string, ministryId: string, role: string }[]>;
    allOccurrences: OccurrenceV2[];
}

export const ScheduleCell: React.FC<ScheduleCellProps> = ({ 
    occurrence, 
    role, 
    currentMemberId, 
    isConfirmed,
    members, 
    onAssign,
    onConfirm,
    processing,
    availability,
    eventTime,
    conflictRules,
    assignments,
    memberCounts,
    globalConflicts,
    allOccurrences
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Robust Click Outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!isOpen) return;
            if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
                return;
            }
            setIsOpen(false);
        };

        // Use mousedown to ensure capture before any blur
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Focus input on opening
    useEffect(() => {
        if (isOpen) {
            setSearchTerm(''); // Clear search on open
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const currentMember = members.find(m => m.id === currentMemberId);
    
    const filteredMembers = members.filter(member => 
        member.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const baseRole = role.replace(/\s\d+$/, '');
    const roleMembers = filteredMembers.filter(m => m.ministry_functions?.includes(baseRole));
    
    const conflictMembers: { member: MemberV2, existingRole: string, type?: string }[] = [];
    const availableMembers: MemberV2[] = [];
    const unavailableMembers: MemberV2[] = [];

    roleMembers.forEach(m => {
        const conflictCheck = isConflict(m.id, role, occurrence.ruleId, occurrence.date, assignments, conflictRules, globalConflicts, allOccurrences, eventTime);
        if (conflictCheck.conflict) {
            conflictMembers.push({ member: m, existingRole: conflictCheck.existingRole!, type: conflictCheck.type });
        } else {
            const status = getMemberAvailStatus(m.id, occurrence.date, eventTime, availability);
            if (status === 'available') availableMembers.push(m);
            else unavailableMembers.push(m);
        }
    });

    const handleSelect = (memberId: string) => {
        onAssign(occurrence.date, role, memberId, occurrence.ruleId);
        setIsOpen(false);
    };

    const handleRemove = () => {
        onAssign(occurrence.date, role, null, occurrence.ruleId);
        setIsOpen(false);
    };

    const currentMemberStatus = currentMemberId ? getMemberAvailStatus(currentMemberId, occurrence.date, eventTime, availability) : null;

    let currentMemberConflict: { conflict: boolean; existingRole?: string; type?: string } = { conflict: false };
    if (currentMemberId) {
        const otherAssignments = assignments.filter(a => !(a.member_id === currentMemberId && a.role === role && a.event_rule_id === occurrence.ruleId && a.event_date === occurrence.date));
        currentMemberConflict = isConflict(currentMemberId, role, occurrence.ruleId, occurrence.date, otherAssignments, conflictRules, globalConflicts, allOccurrences, eventTime);
    }

    const hasAnyAlert = ((currentMemberStatus === 'unavailable') || currentMemberConflict.conflict) && !isConfirmed;

    const handleConfirmOverride = () => {
        if (onConfirm) {
            onConfirm(occurrence.date, role, occurrence.ruleId);
        }
        setIsOpen(false);
    };

    return (
        <div className="relative w-full h-full min-h-[42px]" ref={dropdownRef}>
            {/* Main Button Trigger */}
            <button
                type="button"
                onClick={() => !processing && setIsOpen(!isOpen)}
                disabled={processing}
                className={`schedule-cell button hover:scale-[1.02] duration-200 w-full h-full px-2 py-1.5 flex flex-col items-center justify-center text-sm transition-all rounded-xl border-2 
                    ${currentMember 
                        ? hasAnyAlert
                            ? 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/20'
                            : 'bg-secondary/10 dark:bg-secondary/5 text-secondary dark:text-white border-secondary/20 dark:border-secondary/30 hover:bg-secondary/20' 
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }
                    ${processing ? 'opacity-50 cursor-not-allowed' : ''}
                    ${isOpen ? 'ring-2 ring-secondary/20 border-secondary z-10' : ''}
                `}
            >
                <div className="flex items-center justify-between w-full">
                    {currentMember ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Avatar name={currentMember.name} avatarUrl={currentMember.avatar_url} />
                            <span className="truncate text-xs font-bold">{currentMember.name.split(' ')[0]}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 opacity-40 group-hover:opacity-60 transition-opacity">
                            <div className="w-6 h-6 rounded-full border border-dashed border-zinc-400 dark:border-zinc-600 flex items-center justify-center">
                                <User size={10} className="text-zinc-400" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Vazio</span>
                        </div>
                    )}
                    <ChevronDown size={12} className={`opacity-50 transition-transform ${isOpen ? 'rotate-180 text-secondary dark:text-white' : ''} ${hasAnyAlert ? 'text-red-500' : ''}`} />
                </div>
                {currentMemberStatus === 'unavailable' && (
                    <div className="mt-1 text-[9px] font-bold text-red-600 dark:text-red-500 bg-red-100 dark:bg-red-500/20 px-1.5 py-0.5 rounded w-full text-center">
                        INDISPONÍVEL
                    </div>
                )}
                {currentMemberConflict.conflict && (
                    <div className="mt-1 text-[9px] font-bold text-red-600 dark:text-red-500 bg-red-100 dark:bg-red-500/20 px-1.5 py-0.5 rounded w-full text-center truncate" title={`Conflito: ${currentMemberConflict.existingRole}`}>
                        CONFLITO 
                    </div>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Mobile Overlay */}
                    <div 
                        className="fixed inset-0 bg-black/50 z-[9998] md:hidden" 
                        onMouseDown={() => setIsOpen(false)}
                    />
                    
                    <div className="
                        fixed bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh]
                        md:absolute md:top-full md:bottom-auto md:left-0 md:right-auto md:mt-1 md:w-64 md:rounded-lg md:max-h-none
                        bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col z-[9999] 
                        animate-in slide-in-from-bottom-full md:slide-in-from-top-2 fade-in duration-200
                        pb-[env(safe-area-inset-bottom)]
                    ">
                        {/* Mobile Header */}
                        <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                            <h3 className="font-bold text-zinc-800 dark:text-zinc-100">Selecionar {role}</h3>
                            <button onClick={() => setIsOpen(false)} className="p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="p-3 md:p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-3 md:left-2.5 md:top-2.5 md:w-3 md:h-3 text-zinc-400 pointer-events-none" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Buscar membro..."
                                    className="w-full bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 text-sm md:text-xs rounded-lg md:rounded py-2.5 md:py-2 pl-9 md:pl-8 pr-3 focus:outline-none focus:ring-2 focus:ring-secondary border border-zinc-200 dark:border-zinc-800 placeholder:text-zinc-400"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onClick={(e) => e.stopPropagation()} 
                                />
                            </div>
                        </div>

                        {/* Remove Button */}
                        {currentMember && (
                            <div className="p-2 md:p-1 border-b border-zinc-100 dark:border-zinc-800">
                                {((currentMemberStatus === 'unavailable') || currentMemberConflict.conflict) && !isConfirmed && (
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleConfirmOverride();
                                        }}
                                        className="w-full text-left px-3 md:px-2 py-3 md:py-2 mb-1 text-sm md:text-xs text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg md:rounded flex items-center gap-2 font-medium transition-colors"
                                    >
                                        <Check size={16} className="md:w-3 md:h-3" />
                                        CONFIRMAR PRESENÇA
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleRemove();
                                    }}
                                    className="w-full text-left px-3 md:px-2 py-3 md:py-2 text-sm md:text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg md:rounded flex items-center gap-2 font-medium transition-colors"
                                >
                                    <Trash2 size={16} className="md:w-3 md:h-3" />
                                    REMOVER DA ESCALA
                                </button>
                            </div>
                        )}

                        {/* Member List */}
                        <div className="overflow-y-auto p-2 md:p-1 custom-scrollbar flex-1 max-h-[50vh] md:max-h-60">
                            {roleMembers.length > 0 ? (
                                <>
                                    {availableMembers.length > 0 && (
                                        <div className="mb-2 md:mb-1">
                                            <div className="px-3 md:px-2 py-2 md:py-1 text-xs md:text-[10px] font-bold text-secondary dark:text-white tracking-wider">
                                                DISPONÍVEIS
                                            </div>
                                            {availableMembers.map(member => (
                                                <button
                                                    key={member.id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        handleSelect(member.id);
                                                    }}
                                                    className={`schedule-cell button hover:scale-[1.02] duration-200 w-full text-left px-3 md:px-2 py-3 md:py-2 flex items-center gap-3 md:gap-2 rounded-xl text-sm md:text-xs transition-all border border-transparent
                                                        ${currentMemberId === member.id 
                                                            ? 'bg-secondary/10 dark:bg-secondary/5 text-secondary dark:text-white border-secondary/20' 
                                                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'}
                                                    `}
                                                >
                                                    <Avatar name={member.name} avatarUrl={member.avatar_url} />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className="truncate font-medium">{member.name}</span>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                                                    (memberCounts[member.id] || 0) >= 5 
                                                                        ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' 
                                                                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                                                }`}>
                                                                    {memberCounts[member.id] || 0}x
                                                                </span>
                                                                {(memberCounts[member.id] || 0) >= 5 && (
                                                                    <div title="Limite sugerido atingido (5 escalas)">
                                                                        <AlertTriangle size={10} className="text-amber-500" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {currentMemberId === member.id && <Check size={16} className="md:w-3 md:h-3 text-secondary" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {unavailableMembers.length > 0 && (
                                        <div className="mb-2 md:mb-1">
                                            <div className="px-3 md:px-2 py-2 md:py-1 text-xs md:text-[10px] font-bold text-red-500 dark:text-red-400 tracking-wider">
                                                INDISPONÍVEIS
                                            </div>
                                            {unavailableMembers.map(member => (
                                                <button
                                                    key={member.id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        handleSelect(member.id);
                                                    }}
                                                    className={`schedule-cell button hover:scale-[1.02] duration-200 w-full text-left px-3 md:px-2 py-3 md:py-2 flex items-center gap-3 md:gap-2 rounded-xl text-sm md:text-xs transition-all border border-transparent opacity-50 md:opacity-40
                                                        ${currentMemberId === member.id 
                                                            ? 'bg-secondary/10 dark:bg-secondary/5 text-secondary dark:text-white border-secondary/20' 
                                                            : 'text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'}
                                                    `}
                                                >
                                                    <Avatar name={member.name} avatarUrl={member.avatar_url} />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className="truncate font-medium">{member.name}</span>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                                                    (memberCounts[member.id] || 0) >= 5 
                                                                        ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' 
                                                                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                                                }`}>
                                                                    {memberCounts[member.id] || 0}x
                                                                </span>
                                                                {(memberCounts[member.id] || 0) >= 5 && (
                                                                    <div title="Limite sugerido atingido (5 escalas)">
                                                                        <AlertTriangle size={10} className="text-amber-500" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] md:text-[9px] text-red-500">Indisponível</span>
                                                    </div>
                                                    {currentMemberId === member.id && <Check size={16} className="md:w-3 md:h-3 text-secondary" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {conflictMembers.length > 0 && (
                                        <div className="mb-2 md:mb-1">
                                            <div className="px-3 md:px-2 py-2 md:py-1 text-xs md:text-[10px] font-bold text-red-600 dark:text-red-500 tracking-wider">
                                                JÁ ESCALADO
                                            </div>
                                            {conflictMembers.map(({ member, existingRole, type }) => (
                                                <button
                                                    key={member.id}
                                                    type="button"
                                                    disabled
                                                    className="w-full text-left px-3 md:px-2 py-3 md:py-2 flex items-center gap-3 md:gap-2 rounded-xl text-sm md:text-xs transition-all border border-transparent opacity-50 cursor-not-allowed text-red-600 dark:text-red-400"
                                                    title={type === 'member' ? 'Bloqueio entre membros' : `Já escalado como ${existingRole} neste evento`}
                                                >
                                                    <Avatar name={member.name} avatarUrl={member.avatar_url} />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="truncate font-medium line-through">{member.name}</span>
                                                        <span className="text-[10px] md:text-[9px] font-bold text-red-500">
                                                            {type === 'member' ? 'Bloqueio de Membro' : `Em ${existingRole}`}
                                                        </span>
                                                    </div>
                                                    <Lock size={16} className="md:w-3 md:h-3 text-red-500" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="py-8 flex flex-col items-center justify-center text-zinc-400 gap-2">
                                    <Search size={16} className="opacity-20" />
                                    <span className="text-xs">Nenhum membro encontrado</span>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
