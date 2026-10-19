import React, { useState, useMemo, useEffect } from 'react';
import { Users, Mail, Phone, Gift, ShieldCheck, Trash2, Search, Filter, Shield, Edit2, UserPlus, MessageCircle, ExternalLink, X, Check, ClipboardList, ChevronDown } from 'lucide-react';
import { TeamMemberProfile, User } from '../types';
import { EditMemberModal, InviteModal } from './ManagementModals';
import { checkMemberLimit } from '../services/supabase/auth';
import { useToast } from './Toast';
import { useSession } from '../context/SessionContext';
import { fetchAuditLogs, AuditLogEntry, AUDIT_ACTION_LABELS, AUDIT_ACTION_COLORS, AuditAction } from '../services/supabase/audit';


interface Props {
  members: TeamMemberProfile[];
  onlineUsers: string[];
  currentUser: User;
  onToggleAdmin: (email: string, currentStatus: boolean, name: string) => void;
  onRemoveMember: (id: string, name: string) => void;
  onUpdateMember?: (id: string, data: { name: string, whatsapp: string, ministry_functions: string[], ministryId?: string }) => void;
  availableRoles: string[];
  isPro?: boolean;
  isEnterprise?: boolean;
  notifications?: any[];
  onApproveJoin?: (notificationId: string, userId: string, roles: string[]) => Promise<void>;
  onRejectJoin?: (notificationId: string, userId: string) => Promise<void>;
}

export const MembersScreen: React.FC<Props> = ({ 
  members, 
  onlineUsers, 
  currentUser, 
  onToggleAdmin, 
  onRemoveMember,
  onUpdateMember,
  availableRoles,
  isPro,
  isEnterprise,
  notifications = [],
  onApproveJoin,
  onRejectJoin
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("Todos");
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberProfile | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'members' | 'audit'>('members');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState<AuditAction | 'all'>('all');
  const { addToast, confirmAction } = useToast();
  const { organization } = useSession();

  const isAdmin = currentUser.access_role === 'admin' || currentUser.isSuperAdmin || currentUser.isOrgAdmin;

  // Carrega logs de auditoria quando a aba eé aberta
  useEffect(() => {
    if (activeTab !== 'audit' || !isAdmin) return;
    const load = async () => {
      setAuditLoading(true);
      try {
        const logs = await fetchAuditLogs(currentUser.ministryId || '', currentUser.organizationId || '');
        setAuditLogs(logs);
      } catch (e) {
        addToast('Erro ao carregar logs de auditoria', 'error');
      } finally {
        setAuditLoading(false);
      }
    };
    load();
  }, [activeTab, currentUser.ministryId, currentUser.organizationId, isAdmin]);

  const filteredAuditLogs = useMemo(() => {
    if (auditFilter === 'all') return auditLogs;
    return auditLogs.filter(l => l.action === auditFilter);
  }, [auditLogs, auditFilter]);


  // Filter join requests from notifications
  const joinRequests = useMemo(() => {
      const isAdmin = currentUser.access_role === 'admin' || currentUser.isSuperAdmin || currentUser.isOrgAdmin;
      if (!isAdmin) return [];

      return notifications
        .filter(n => {
            const isJoinType = n.type === 'join_request';
            const hasJoinData = typeof n.actionLink === 'string' && n.actionLink.startsWith('{') && n.actionLink.includes('"userId"');
            const nMinId = n.ministryId || (n as any).ministry_id;
            return (isJoinType || hasJoinData) && nMinId === currentUser.ministryId;
        })
        .map(n => {
            try {
                const data = typeof n.actionLink === 'string' ? JSON.parse(n.actionLink) : n.actionLink;
                if (!data.userId || !data.userName) return null;
                return {
                    id: n.id,
                    userId: data.userId,
                    userName: data.userName,
                    roles: data.roles || [],
                    timestamp: n.timestamp
                };
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean) as any[];
  }, [notifications, currentUser.ministryId, currentUser.access_role, currentUser.isSuperAdmin, currentUser.isOrgAdmin]);

  const handleInviteClick = () => {
    const plan = organization?.plan_type || 'trial';
    if (plan === 'trial' && members.length >= 10) {
      addToast(
        'Limite do Trial atingido (10 membros). Faça o upgrade para o Plano Pro.',
        'error'
      );
      return;
    }
    if (plan === 'pro' && members.length >= 50) {
      addToast(
        'Limite do Plano Pro atingido (50 membros). Faça o upgrade para Enterprise.',
        'error'
      );
      return;
    }
    setIsInviteOpen(true);
  };

  React.useEffect(() => {
      if (selectedRole !== "Todos" && !availableRoles.includes(selectedRole)) {
          setSelectedRole("Todos");
      }
  }, [availableRoles, selectedRole]);

  const filteredMembers = useMemo(() => {
      return members
        .filter(member => {
            const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                   (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesRole = selectedRole === "Todos" || (member.ministry_functions && member.ministry_functions.includes(selectedRole));
            
            const matchesOnline = showOnlineOnly ? onlineUsers.includes(member.id) : true;

            return matchesSearch && matchesRole && matchesOnline;
        })
        .sort((a, b) => a.name.localeCompare(b.name)); 
  }, [members, searchTerm, selectedRole, showOnlineOnly, onlineUsers]);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-28">

        {/* Tab Header — sempre visível para teste */}
        <div role="tablist" aria-label="Gerenciamento de membros" className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit">
            <button
                role="tab"
                aria-selected={activeTab === 'members'}
                aria-controls="panel-members"
                onClick={() => setActiveTab('members')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'members'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
            >
                <Users size={15}/> Membros
            </button>
            <button
                role="tab"
                aria-selected={activeTab === 'audit'}
                aria-controls="panel-audit"
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'audit'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
            >
                <ClipboardList size={15}/> Auditoria
            </button>
        </div>

        {/* ─── ABA AUDITORIA ─── */}
        {activeTab === 'audit' && (

            <div id="panel-audit" role="tabpanel" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                            <ClipboardList className="text-secondary dark:text-white"/> Log de Auditoria
                        </h2>
                        <p className="text-zinc-500 text-sm mt-1">Registro de todas as ações realizadas pelos administradores.</p>
                    </div>
                    <div className="relative min-w-[220px]">
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"/>
                        <select
                            value={auditFilter}
                            onChange={e => setAuditFilter(e.target.value as AuditAction | 'all')}
                            className="w-full pl-3 pr-8 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary appearance-none cursor-pointer text-zinc-700 dark:text-zinc-300"
                        >
                            <option value="all">Todas as ações</option>
                            <optgroup label="Membros">
                                <option value="member_added">Adicionou membro</option>
                                <option value="member_removed">Removeu membro</option>
                                <option value="member_role_changed">Alterou cargo</option>
                                <option value="join_request_approved">Aprovou solicitação</option>
                                <option value="join_request_rejected">Recusou solicitação</option>
                            </optgroup>
                            <optgroup label="Configurações">
                                <option value="settings_updated">Configurações</option>
                                <option value="tabs_updated">Abas visíveis</option>
                            </optgroup>
                            <optgroup label="Escala">
                                <option value="swap_approved">Troca aprovada</option>
                                <option value="swap_rejected">Troca recusada</option>
                                <option value="event_rule_created">Regra de agenda criada</option>
                                <option value="event_rule_deleted">Regra de agenda excluída</option>
                                <option value="schedule_rule_created">Regra de escala criada</option>
                                <option value="schedule_rule_deleted">Regra de escala excluída</option>
                                <option value="schedule_rule_updated">Regra de escala atualizada</option>
                            </optgroup>
                            <optgroup label="Conteúdo">
                                <option value="announcement_created">Aviso publicado</option>
                                <option value="announcement_deleted">Aviso excluído</option>
                            </optgroup>
                        </select>
                    </div>
                </div>

                {auditLoading ? (
                    <div className="flex items-center justify-center py-20 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"/>
                            <p className="text-zinc-500 text-sm font-medium">Carregando auditoria...</p>
                        </div>
                    </div>
                ) : filteredAuditLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-800 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
                        <ClipboardList size={40} className="text-zinc-300 dark:text-zinc-600 mb-3"/>
                        <p className="text-zinc-500 font-bold">Nenhum registro encontrado</p>
                        <p className="text-zinc-400 text-sm mt-1">As ações dos administradores aparecerão aqui.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredAuditLogs.map(log => (
                            <div key={log.id} className="bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start gap-3 hover:shadow-sm transition-shadow">
                                {/* Avatar / Iniciais */}
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-secondary to-secondaryHover flex items-center justify-center text-white text-sm font-bold shrink-0">
                                    {log.actor_name?.charAt(0).toUpperCase() || '?'}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">{log.actor_name}</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${AUDIT_ACTION_COLORS[log.action as AuditAction] || 'bg-zinc-100 text-zinc-600'}` }>
                                            {AUDIT_ACTION_LABELS[log.action as AuditAction] || log.action}
                                        </span>
                                        {log.target_name && (
                                            <span className="text-zinc-500 dark:text-zinc-400 text-sm font-medium truncate">→ {log.target_name}</span>
                                        )}
                                    </div>
                                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                                        <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                            {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                        </p>
                                    )}
                                </div>

                                <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 whitespace-nowrap">
                                    {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* ─── ABA MEMBROS (existente) ─── */}
        {activeTab === 'members' && (
        <div id="panel-members" role="tabpanel">

        {joinRequests.length > 0 && (
            <div className="bg-ministral-50 dark:bg-ministral-900/10 border border-ministral-200 dark:border-ministral-800/50 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <UserPlus className="text-ministral-600 dark:text-ministral-400" size={20}/>
                    <h3 className="text-lg font-bold text-ministral-900 dark:text-ministral-100">Solicitações de Entrada ({joinRequests.length})</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {joinRequests.map((req: any) => (
                        <div key={req.id} className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-ministral-200 dark:border-zinc-700 shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-zinc-800 dark:text-zinc-100">{req.userName}</p>
                                    <p className="text-xs text-zinc-500">{new Date(req.timestamp).toLocaleString('pt-BR')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => onRejectJoin?.(req.id, req.userId)}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Recusar"
                                    >
                                        <X size={18}/>
                                    </button>
                                    <button 
                                        onClick={() => onApproveJoin?.(req.id, req.userId, req.roles)}
                                        className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                        title="Aprovar"
                                    >
                                        <Check size={18}/>
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {req.roles.map((r: string) => (
                                    <span key={r} className="text-[10px] font-medium px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded">
                                        {r}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="flex flex-col gap-6 border-b border-zinc-200 dark:border-zinc-700 pb-6">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                   <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                       <Users className="text-secondary dark:text-white"/> Membros & Equipe
                   </h2>
                   <p className="text-zinc-500 text-sm mt-1">Gerencie os integrantes, funções e permissões de acesso.</p>
               </div>
               
               <div className="flex items-center gap-2">
                   <button 
                       onClick={handleInviteClick}
                       className="hidden md:flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondaryHover text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-secondary/20 active:scale-95"
                   >
                       <UserPlus size={16}/> Convidar Membro
                   </button>

                   <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-1.5 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-300 shadow-sm">
                       Total: {filteredMembers.length} <span className="text-zinc-400 font-normal">/ {members.length}</span>
                   </div>
               </div>
           </div>

           <div className="flex flex-col md:flex-row gap-3">
               <button 
                   onClick={handleInviteClick}
                   className="md:hidden w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary hover:bg-secondaryHover text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-secondary/20 active:scale-95 mb-2"
               >
                   <UserPlus size={18}/> Convidar Novo Membro
               </button>

               <div className="relative flex-1">
                   <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                   <input 
                        type="text" 
                        placeholder="Buscar por nome ou e-mail..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-secondary outline-none transition-all placeholder:text-zinc-400 text-zinc-800 dark:text-zinc-200"
                   />
               </div>
               <div className="relative min-w-[200px]">
                   <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                   <select 
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-secondary outline-none appearance-none cursor-pointer text-zinc-700 dark:text-zinc-300 font-medium"
                   >
                       <option value="Todos">Todas as Funções</option>
                       {availableRoles.map(role => (
                           <option key={role} value={role}>{role}</option>
                       ))}
                   </select>
               </div>
           </div>
        </div>

        {filteredMembers.length === 0 ? (
            <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <Users className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" size={48} />
                <p className="text-zinc-500 font-medium">Nenhum membro encontrado.</p>
                <p className="text-xs text-zinc-400 mt-1">Tente ajustar os filtros de busca.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-3.5 auto-rows-fr items-stretch">
            {filteredMembers.map(member => {
                const isOnline = onlineUsers.includes(member.id);
                const isSelf = currentUser.id === member.id;
                const memberFunctions = member.ministry_functions || [];
                const isExpanded = expandedCards[member.id] !== false; // expanded by default

                return (
                <div key={member.id} className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-3.5 flex flex-col relative group shadow-sm hover:shadow-md transition-all hover:border-zinc-300 dark:hover:border-zinc-700 animate-slide-up h-full">
                    {/* Row 1: Avatar + Full Name + Expander */}
                    <div className="flex items-center gap-2.5">
                        <div className="relative shrink-0">
                            {member.avatar_url ? (
                                <img src={member.avatar_url} alt={member.name} className="w-10 h-10 rounded-full object-cover border-2 border-zinc-100 dark:border-zinc-700 shadow-sm" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-secondary to-secondaryHover flex items-center justify-center text-white text-base font-bold border-2 border-zinc-100 dark:border-zinc-700 shadow-sm">
                                    {member.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            {isOnline && (
                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-secondary rounded-full border-2 border-white dark:border-[#18181b] animate-pulse shadow-sm" title="Online Agora"></div>
                            )}
                        </div>
                        <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 flex-1 min-w-0 break-words leading-tight min-h-[2rem] flex items-center" title={member.name}>
                            {member.name} {isSelf && <span className="text-secondary dark:text-white text-xs ml-1">(Você)</span>}
                        </h3>
                        <button
                            onClick={() => setExpandedCards(prev => ({ ...prev, [member.id]: !isExpanded }))}
                            aria-label={isExpanded ? `Recolher detalhes de ${member.name}` : `Expandir detalhes de ${member.name}`}
                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all shrink-0"
                        >
                            <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Row 2: Role Badge + Admin Actions */}
                    <div className="flex items-center justify-between mt-2 gap-2">
                        <div className="flex items-center gap-1.5">
                            {member.isAdmin ? (
                                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-ministral-gold bg-ministral-gold/10 px-1.5 py-0.5 rounded border border-ministral-gold/20">
                                    <ShieldCheck size={9} /> Admin
                                </span>
                            ) : (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                    Membro
                                </span>
                            )}
                        </div>
                        {!isSelf && (
                            <div className="flex items-center gap-0.5">
                                <button
                                    onClick={() => setEditingMember(member)}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-secondary hover:bg-secondary/10 dark:hover:bg-secondaryHover/10 transition-colors"
                                    title="Editar Membro"
                                    aria-label={`Editar ${member.name}`}
                                >
                                    <Edit2 size={13} />
                                </button>

                                <button 
                                    onClick={() => {
                                        const memberEmail = member.email;
                                        if (!memberEmail) return;
                                        if (!isEnterprise) {
                                            const adminsCount = members.filter(m => m.isAdmin).length;
                                            if (!member.isAdmin && adminsCount >= 1) {
                                                addToast(
                                                    'Múltiplos administradores estão disponíveis apenas no Plano Enterprise.',
                                                    'error'
                                                );
                                                return;
                                            }
                                        }
                                        const action = member.isAdmin ? 'remover admin de' : 'tornar admin';
                                        confirmAction(
                                            member.isAdmin ? 'Remover Administrador' : 'Tornar Administrador',
                                            `Deseja ${action} ${member.name}?`,
                                            () => onToggleAdmin(memberEmail, !!member.isAdmin, member.name)
                                        );
                                    }} 
                                    className={`p-1.5 rounded-lg transition-colors ${member.isAdmin ? 'text-ministral-gold hover:bg-ministral-gold/10' : 'text-zinc-400 hover:text-secondary hover:bg-zinc-50 dark:hover:bg-zinc-800'}`} 
                                    title={!isEnterprise && !member.isAdmin
                                        ? 'Múltiplos admins — somente Plano Enterprise'
                                        : member.isAdmin ? 'Remover Admin' : 'Tornar Admin'
                                    }
                                    aria-label={member.isAdmin ? `Remover admin de ${member.name}` : `Tornar ${member.name} admin`}
                                >
                                    <Shield size={13} fill={member.isAdmin ? "currentColor" : "none"} />
                                </button>
                                
                                <button 
                                    onClick={() => {
                                        confirmAction(
                                            "Remover Membro",
                                            `Deseja realmente remover ${member.name} da equipe? Esta ação não pode ser desfeita.`,
                                            () => onRemoveMember(member.id, member.name)
                                        );
                                    }}
                                    aria-label={`Remover ${member.name} da equipe`}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Expanded Area: Functions + Contact */}
                    {isExpanded && (
                        <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/50 space-y-2 animate-fade-in">
                            {/* Functions */}
                            <div className="flex flex-wrap gap-1.5 min-h-[22px]">
                                {memberFunctions.length > 0 ? (
                                    memberFunctions.map(role => (
                                        <span key={role} className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700/50">
                                            {role}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-[11px] text-zinc-400 italic px-1">Sem função definida</span>
                                )}
                            </div>

                            {/* Contact Details */}
                            <div className="space-y-1.5 text-xs">
                                <div className="flex items-center gap-2.5 text-zinc-500 dark:text-zinc-400 group/item hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                                    <Mail size={13} className="text-zinc-300 dark:text-zinc-600 shrink-0"/>
                                    <span className="truncate">{member.email || "Sem e-mail"}</span>
                                </div>
                                <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 group/item hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                                    <div className="flex items-center gap-2.5 truncate">
                                        <MessageCircle size={13} className="text-zinc-300 dark:text-zinc-600 shrink-0"/>
                                        {member.whatsapp ? <span className="truncate">{member.whatsapp}</span> : <span className="text-zinc-400 italic text-xs">WhatsApp não informado</span>}
                                    </div>
                                    {member.whatsapp && /^\(\d{2}\) \d{5}-\d{4}$/.test(member.whatsapp) && (
                                        <button 
                                            onClick={() => window.open(`https://wa.me/55${member.whatsapp!.replace(/\D/g, '')}`, '_blank')}
                                            className="p-1 text-secondary dark:text-white hover:bg-secondary/10 rounded transition-colors"
                                            title="Abrir WhatsApp"
                                        >
                                            <ExternalLink size={14} />
                                        </button>
                                    )}
                                </div>
                                {member.birthDate && (
                                    <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 group/item hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                                        <Gift size={15} className="text-zinc-300 dark:text-zinc-600 shrink-0"/>
                                        <span className="truncate">{new Date(member.birthDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                );
            })}
            </div>
        )}

        {/* Edit Modal */}
        {editingMember && (
            <EditMemberModal 
                isOpen={!!editingMember}
                onClose={() => setEditingMember(null)}
                member={editingMember}
                availableRoles={availableRoles}
                onSave={(id, data) => { 
                    if(onUpdateMember) onUpdateMember(id, { ...data, ministryId: currentUser.ministryId }); 
                }}
            />
        )}

        {/* Invite Modal (New) */}
        {isInviteOpen && currentUser.ministryId && currentUser.organizationId && (
            <InviteModal
                isOpen={isInviteOpen}
                onClose={() => setIsInviteOpen(false)}
                ministryId={currentUser.ministryId}
                orgId={currentUser.organizationId}
            />
        )}
        </div>
        )}
    </div>
  );
};