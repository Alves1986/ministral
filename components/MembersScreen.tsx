import React, { useState, useMemo } from 'react';
import { Users, Mail, Phone, Gift, ShieldCheck, Trash2, Search, Filter, Shield, Edit2, UserPlus, MessageCircle, ExternalLink, X, Check } from 'lucide-react';
import { TeamMemberProfile, User } from '../types';
import { EditMemberModal, InviteModal } from './ManagementModals';
import { checkMemberLimit } from '../services/supabase/auth';
import { useToast } from './Toast';
import { useSession } from '../context/SessionContext';

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
  const { addToast } = useToast();
  const { organization } = useSession();

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
        {/* Join Requests Section */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredMembers.map(member => {
                const isOnline = onlineUsers.includes(member.id);
                const isSelf = currentUser.id === member.id;
                
                const memberFunctions = member.ministry_functions || [];

                return (
                <div key={member.id} className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4 relative group shadow-sm hover:shadow-md transition-all hover:border-zinc-300 dark:hover:border-zinc-700 animate-slide-up">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className="relative">
                                {member.avatar_url ? (
                                    <img src={member.avatar_url} alt={member.name} className="w-14 h-14 rounded-full object-cover border-2 border-zinc-100 dark:border-zinc-700 shadow-sm" />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-secondary to-secondaryHover flex items-center justify-center text-white text-xl font-bold border-2 border-zinc-100 dark:border-zinc-700 shadow-sm">
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                {isOnline && (
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-secondary rounded-full border-2 border-white dark:border-[#18181b] animate-pulse shadow-sm" title="Online Agora"></div>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100 truncate max-w-[150px]" title={member.name}>
                                    {member.name} {isSelf && <span className="text-secondary dark:text-white text-xs">(Você)</span>}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    {member.isAdmin ? (
                                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ministral-gold bg-ministral-gold/10 px-2 py-0.5 rounded border border-ministral-gold/20">
                                            <ShieldCheck size={10} /> Admin
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                            Membro
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {!isSelf && (
                            <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => setEditingMember(member)}
                                    className="p-2 rounded-lg text-zinc-400 hover:text-secondary hover:bg-secondary/10 dark:hover:bg-secondaryHover/10 transition-colors"
                                    title="Editar Membro"
                                >
                                    <Edit2 size={16} />
                                </button>

                                <button 
                                    onClick={() => {
                                        if (!member.email) return;
                                        if (!isEnterprise) {
                                            // Verificar se é o criador (único admin atual)
                                            const adminsCount = members.filter(m => m.isAdmin).length;
                                            if (!member.isAdmin && adminsCount >= 1) {
                                                // Tentando promover novo admin sem ser Enterprise
                                                addToast(
                                                    'Múltiplos administradores estão disponíveis apenas no Plano Enterprise.',
                                                    'error'
                                                );
                                                return;
                                            }
                                        }
                                        const action = member.isAdmin ? 'remover admin de' : 'tornar admin';
                                        if (window.confirm(`Deseja ${action} ${member.name}?`)) {
                                            onToggleAdmin(member.email, !!member.isAdmin, member.name);
                                        }
                                    }} 
                                    className={`p-2 rounded-lg transition-colors ${member.isAdmin ? 'text-ministral-gold hover:bg-ministral-gold/10' : 'text-zinc-400 hover:text-secondary hover:bg-zinc-50 dark:hover:bg-zinc-800'}`} 
                                    title={!isEnterprise && !member.isAdmin
                                        ? 'Múltiplos admins — somente Plano Enterprise'
                                        : member.isAdmin ? 'Remover Admin' : 'Tornar Admin'
                                    }
                                >
                                    <Shield size={16} fill={member.isAdmin ? "currentColor" : "none"} />
                                </button>
                                
                                <button 
                                    onClick={() => onRemoveMember(member.id, member.name)} 
                                    className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Remover da Equipe"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 min-h-[26px]">
                        {memberFunctions.length > 0 ? (
                            memberFunctions.map(role => (
                                <span key={role} className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700/50">
                                    {role}
                                </span>
                            ))
                        ) : (
                            <span className="text-xs text-zinc-400 italic px-1">Sem função definida</span>
                        )}
                    </div>

                    <hr className="border-zinc-100 dark:border-zinc-800/50" />

                    <div className="space-y-2.5 text-sm">
                        <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 group/item hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                            <Mail size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0"/>
                            <span className="truncate">{member.email || "Sem e-mail"}</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 group/item hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                            <div className="flex items-center gap-3 truncate">
                                <MessageCircle size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0"/>
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
                                <Gift size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0"/>
                                <span className="truncate">{new Date(member.birthDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span>
                            </div>
                        )}
                    </div>
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
  );
};