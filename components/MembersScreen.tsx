import React, { useState, useMemo, useEffect } from 'react';
import { Users, Mail, Phone, Gift, ShieldCheck, Trash2, Search, Filter, Shield, Edit2, UserPlus, MessageCircle, ExternalLink, X, Check, ClipboardList, ChevronDown } from 'lucide-react';
import { TeamMemberProfile, User } from '../types';
import { EditMemberModal, InviteModal } from './ManagementModals';
import { checkMemberLimit } from '../services/supabase/auth';
import { useToast } from './Toast';
import { useSession } from '../context/SessionContext';
import { fetchAuditLogs, AuditLogEntry, AUDIT_ACTION_LABELS, AUDIT_ACTION_COLORS, AuditAction } from '../services/supabase/audit';
import { getSupabase } from '../services/supabase/client';
import { cleanupStaleJoinNotifications } from '../services/supabase/ministries';

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
  onApproveJoin?: (notificationId: string, userId: string, roles: string[], ministryId?: string) => Promise<void>;
  onRejectJoin?: (notificationId: string, userId: string, ministryId?: string) => Promise<void>;
}

// Helper para limpar e sanitizar nome extraído de notificações
const cleanExtractedName = (raw: string): string => {
  if (!raw) return '';
  let cleaned = raw
    .replace(/^["']|["']$/g, '') // remove aspas
    .replace(/\s*\(Minist[ée]rio:.*?\)/gi, '') // remove trailing (Ministério: ...)
    .replace(/\s*no minist[ée]rio.*$/gi, '') // remove trailing no ministério...
    .trim();

  // Remove leading "O usuário", "O membro", etc. se inadvertidamente capturado
  cleaned = cleaned.replace(/^O\s+(?:usu[áa]rio|membro|volunt[áa]rio)\s+/i, '').trim();

  const invalidNames = [
    'undefined', 'null', 'novo integrante', 'usuário', 'usuario', 
    'o usuário', 'o usuario', 'membro', 'o membro', 'voluntário', 
    'voluntario', 'o voluntário', 'o voluntario'
  ];

  if (invalidNames.includes(cleaned.toLowerCase())) {
    return '';
  }

  return cleaned;
};

// Parser com múltiplas heurísticas para extrair dados da solicitação
const parseNotificationDetails = (n: any) => {
  let userId = n.targetUserId || n.target_user_id || '';
  let userName = '';
  let userEmail = '';
  let roles: string[] = [];

  // 1. Tenta extrair de actionLink (JSON ou UUID)
  if (typeof n.actionLink === 'string') {
    const trimmed = n.actionLink.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.userId) userId = String(parsed.userId);
        if (parsed.userName) userName = String(parsed.userName);
        if (parsed.email || parsed.userEmail) userEmail = String(parsed.email || parsed.userEmail);
        if (Array.isArray(parsed.roles)) roles = parsed.roles;
      } catch (e) {}
    } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      userId = trimmed;
    }
  }

  const message = typeof n.message === 'string' ? n.message : '';
  const title = typeof n.title === 'string' ? n.title : '';

  // 2. Tenta extrair de marcador em message ([DADOS_SOLICITACAO:{...}] ou <!--JOIN_DATA:{...}-->)
  if (!userId || !userName) {
    const markerMatch = message.match(/\[DADOS_SOLICITACAO:(.*?)\]/) || message.match(/<!--JOIN_DATA:(.*?)-->/);
    if (markerMatch && markerMatch[1]) {
      try {
        const parsed = JSON.parse(markerMatch[1]);
        if (parsed.userId) userId = String(parsed.userId);
        if (parsed.userName) userName = String(parsed.userName);
        if (parsed.email || parsed.userEmail) userEmail = String(parsed.email || parsed.userEmail);
        if (Array.isArray(parsed.roles)) roles = parsed.roles;
      } catch (e) {}
    }
  }

  // 3. Tenta extrair JSON genérico embutido em message
  if (!userId || !userName) {
    const jsonMatch = message.match(/\{[\s\S]*?"userId"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.userId) userId = String(parsed.userId);
        if (parsed.userName) userName = String(parsed.userName);
        if (parsed.email || parsed.userEmail) userEmail = String(parsed.email || parsed.userEmail);
        if (Array.isArray(parsed.roles)) roles = parsed.roles;
      } catch (e) {}
    }
  }

  // 4. Heurísticas de extração de nome no texto da mensagem e título
  if (!userName) {
    // a. "O usuário/membro [Nome] solicitou entrada / entrou diretamente"
    const m1 = message.match(/O\s+(?:usu[áa]rio|membro|volunt[áa]rio)\s+([^\n\r.]+?)\s+(?:solicitou entrada|entrou diretamente|pediu para entrar|quer entrar)/i);
    if (m1 && m1[1] && m1[1].trim()) {
      userName = m1[1].trim();
    }
  }

  if (!userName) {
    // b. "[Nome] solicitou entrada no ministério" (no início da mensagem ou após quebra de linha)
    const m2 = message.match(/(?:^|\n|:\s*)([A-ZÀ-Úa-zà-ú0-9._%+-]+(?:\s+[A-ZÀ-Úa-zà-ú0-9._%+-]+)+)\s+solicitou entrada/i);
    if (m2 && m2[1] && m2[1].trim()) {
      userName = m2[1].trim();
    }
  }

  if (!userName) {
    // c. "Solicitação de entrada de [Nome]" ou "Solicitação de entrada: [Nome]"
    const m3 = message.match(/solicita[çc][ãa]o\s+de\s+entrada\s*(?:de|:)\s*(?:O usu[áa]rio\s+)?([^\n\r(.:]+)/i);
    if (m3 && m3[1] && m3[1].trim()) {
      userName = m3[1].trim();
    }
  }

  if (!userName) {
    // d. "Novo Integrante: [Nome]" ou "Novo Integrante (Entrada Direta): [Nome]"
    const m4 = (title + ' ' + message).match(/novo integrante(?:\s*\([^)]*\))?\s*:\s*(?:O\s+usu[áa]rio\s+)?([^\n\r(.:]+)/i);
    if (m4 && m4[1] && m4[1].trim()) {
      userName = m4[1].trim();
    }
  }

  if (!userName) {
    // e. Se no título há "Solicitação de Entrada - [Nome]"
    const m5 = title.match(/solicita[çc][ãa]o\s+de\s+entrada\s*[-:]\s*(.+)/i);
    if (m5 && m5[1] && m5[1].trim()) {
      userName = m5[1].trim();
    }
  }

  // 5. Extração de Email
  const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch && emailMatch[1]) {
    userEmail = emailMatch[1].trim();
    if (!userName) {
      userName = userEmail;
    }
  }

  userName = cleanExtractedName(userName);

  return { userId, userName, userEmail, roles };
};

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


  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [dismissedRequestIds, setDismissedRequestIds] = useState<string[]>([]);
  const [resolvedProfiles, setResolvedProfiles] = useState<Record<string, {
    userId: string;
    name: string;
    email: string;
    avatarUrl?: string;
  }>>({});
  const [orgCandidates, setOrgCandidates] = useState<Array<{ id: string; name: string; email: string; avatar_url?: string }>>([]);
  const [manualSelections, setManualSelections] = useState<Record<string, string>>({});

  // Limpeza automática de notificações de solicitações obsoletas no Supabase via consulta aos membros
  useEffect(() => {
    if (currentUser.ministryId && currentUser.organizationId && isAdmin) {
      cleanupStaleJoinNotifications(currentUser.ministryId, currentUser.organizationId);
    }
  }, [currentUser.ministryId, currentUser.organizationId, isAdmin]);

  // Carrega voluntários da organização para resolver perfil e permitir vinculação direta
  useEffect(() => {
    if (!currentUser.organizationId || !isAdmin) return;
    let isMounted = true;
    const loadCandidates = async () => {
      const sb = getSupabase();
      if (!sb) return;
      try {
        const { data } = await sb
          .from('profiles')
          .select('id, name, email, avatar_url')
          .eq('organization_id', currentUser.organizationId);
        if (data && isMounted) {
          setOrgCandidates(data);
        }
      } catch (e) {
        console.warn('[MembersScreen] Erro ao carregar candidatos da org:', e);
      }
    };
    loadCandidates();
    return () => { isMounted = false; };
  }, [currentUser.organizationId, isAdmin]);

  // Filter join requests from notifications — blindado com verificação de membros existentes e desfechos
  const joinRequests = useMemo(() => {
      const isAdmin = currentUser.access_role === 'admin' || currentUser.isSuperAdmin || currentUser.isOrgAdmin;
      if (!isAdmin) return [];

      return (notifications || [])
        .filter(n => {
            const titleLower = (n.title || '').toLowerCase();
            const msgLower = (typeof n.message === 'string' ? n.message : '').toLowerCase();

            // 1. Excluir notificações de desfecho (aprovação / recusa / cancelamento já concluídos)
            const isOutcome = 
                titleLower.includes('aprovad') || 
                titleLower.includes('recusad') || 
                titleLower.includes('rejeitad') || 
                titleLower.includes('cancelad') ||
                msgLower.includes('foi aprovada') || 
                msgLower.includes('foi recusada') || 
                msgLower.includes('recusada pelos') ||
                msgLower.includes('recusada por');

            if (isOutcome) return false;

            const isJoinType = n.type === 'join_request' || 
                               titleLower.includes('solicita') || 
                               titleLower.includes('novo integrante') ||
                               msgLower.includes('solicitou entrada') ||
                               msgLower.includes('entrou diretamente');
            const hasJoinData = typeof n.actionLink === 'string' && (n.actionLink.includes('"userId"') || n.actionLink.includes('join'));
            const nMinId = n.ministryId || (n as any).ministry_id;
            
            // Permite ver solicitações apenas do ministério ativo
            const matchesMinistry = !nMinId || nMinId === currentUser.ministryId;
            return (isJoinType || hasJoinData) && matchesMinistry;
        })
        .map(n => {
            try {
                const parsed = parseNotificationDetails(n);

                // 2. REGRA COM CONSULTA: Se o membro já faz parte da equipe deste ministério, NUNCA exibir em solicitações
                const reqUserId = parsed.userId;
                const reqEmail = parsed.userEmail ? parsed.userEmail.toLowerCase().trim() : '';
                const reqName = parsed.userName ? parsed.userName.toLowerCase().trim() : '';

                const alreadyInMinistry = members.some(m => {
                    if (reqUserId && m.id === reqUserId) return true;
                    if (reqEmail && m.email && m.email.toLowerCase().trim() === reqEmail) return true;
                    if (reqName && reqName.length >= 3 && m.name && m.name.toLowerCase().trim() === reqName) return true;
                    return false;
                });

                if (alreadyInMinistry) return null;

                return {
                    id: n.id,
                    ministryId: n.ministryId || currentUser.ministryId,
                    ministryName: n.ministryName || 'Ministério',
                    userId: parsed.userId,
                    userName: parsed.userName,
                    userEmail: parsed.userEmail,
                    roles: parsed.roles || [],
                    timestamp: n.timestamp,
                    rawMessage: n.message,
                    rawTitle: n.title
                };
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean) as any[];
  }, [notifications, currentUser.ministryId, currentUser.access_role, currentUser.isSuperAdmin, currentUser.isOrgAdmin, members]);

  // Resolução inteligente de perfis para cada solicitação
  useEffect(() => {
    if (!joinRequests.length || !orgCandidates.length) return;
    const newResolved: Record<string, { userId: string; name: string; email: string; avatarUrl?: string }> = {};

    joinRequests.forEach(req => {
      let matched: { id: string; name: string; email: string; avatar_url?: string } | undefined = undefined;

      // 1. Pelo ID do usuário (se veio na notificação)
      if (req.userId) {
        matched = orgCandidates.find(c => c.id === req.userId);
      }

      // 2. Pelo email extraído
      if (!matched && req.userEmail) {
        const cleanEmail = req.userEmail.toLowerCase().trim();
        matched = orgCandidates.find(c => c.email && c.email.toLowerCase().trim() === cleanEmail);
      }

      // 3. Pelo nome extraído (exato ou parcial)
      if (!matched && req.userName) {
        const targetName = req.userName.toLowerCase().trim();
        matched = orgCandidates.find(c => {
          if (!c.name) return false;
          const cName = c.name.toLowerCase().trim();
          return cName === targetName || cName.includes(targetName) || targetName.includes(cName);
        });
      }

      // 4. Se a mensagem bruta contiver o nome ou email de algum candidato da org
      if (!matched && req.rawMessage) {
        const rawLower = req.rawMessage.toLowerCase();
        matched = orgCandidates.find(c => {
          if (c.email && rawLower.includes(c.email.toLowerCase())) return true;
          if (c.name && c.name.length >= 3) {
            const parts = c.name.toLowerCase().split(/\s+/).filter(p => p.length >= 3);
            if (parts.length > 0 && parts.every(p => rawLower.includes(p))) return true;
            if (rawLower.includes(c.name.toLowerCase())) return true;
          }
          return false;
        });
      }

      if (matched) {
        newResolved[req.id] = {
          userId: matched.id,
          name: matched.name || matched.email || 'Voluntário',
          email: matched.email || '',
          avatarUrl: matched.avatar_url
        };
      }
    });

    if (Object.keys(newResolved).length > 0) {
      setResolvedProfiles(prev => ({ ...prev, ...newResolved }));
    }
  }, [joinRequests, orgCandidates]);

  // Lista visível final: oculta solicitações dispensadas ou cujos perfis já estejam integrados à equipe
  const visibleRequests = useMemo(() => {
    return joinRequests.filter(req => {
      if (dismissedRequestIds.includes(req.id)) return false;

      // Resolução inteligente: se o perfil resolvido ou manual já faz parte dos membros, oculta imediatamente
      const resolved = resolvedProfiles[req.id];
      const manualId = manualSelections[req.id];
      const effectiveUid = manualId || req.userId || resolved?.userId;
      const effectiveEmail = (resolved?.email || req.userEmail || '').toLowerCase().trim();
      const effectiveName = (resolved?.name || req.userName || '').toLowerCase().trim();

      const alreadyInMinistry = members.some(m => {
        if (effectiveUid && m.id === effectiveUid) return true;
        if (effectiveEmail && m.email && m.email.toLowerCase().trim() === effectiveEmail) return true;
        if (effectiveName && effectiveName.length >= 3 && m.name && m.name.toLowerCase().trim() === effectiveName) return true;
        return false;
      });

      return !alreadyInMinistry;
    });
  }, [joinRequests, dismissedRequestIds, resolvedProfiles, manualSelections, members]);

  const handleApproveJoin = async (req: any) => {
    setApprovingId(req.id);
    try {
      let targetUserId = manualSelections[req.id] || req.userId || resolvedProfiles[req.id]?.userId;

      // Se o userId não veio no JSON, tenta resolver por busca direta em profiles por nome ou email
      if (!targetUserId && (req.userName || req.userEmail)) {
        const sb = getSupabase();
        if (sb && currentUser.organizationId) {
          const searchVal = (req.userName || req.userEmail).trim();
          const { data } = await sb
            .from('profiles')
            .select('id, name, email')
            .eq('organization_id', currentUser.organizationId)
            .or(`name.ilike.%${searchVal}%,email.ilike.%${searchVal}%`)
            .limit(1);
          if (data && data[0]?.id) {
            targetUserId = data[0].id;
          }
        }
      }

      if (!targetUserId) {
        addToast(`Por favor, selecione qual membro da organização corresponde a esta solicitação no campo "Vincular a:" antes de aprovar.`, 'warning');
        return;
      }

      // Otimista: remove imediatamente da lista na interface para não ficar travado na tela
      setDismissedRequestIds(prev => [...prev, req.id]);

      await onApproveJoin?.(req.id, targetUserId, req.roles, req.ministryId);
    } catch (e: any) {
      console.error('[MembersScreen] Erro ao aprovar solicitação:', e);
      addToast(e?.message || 'Erro ao aprovar solicitação.', 'error');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectJoin = async (req: any) => {
    setApprovingId(req.id);
    try {
      // Otimista: remove imediatamente da lista na interface
      setDismissedRequestIds(prev => [...prev, req.id]);

      await onRejectJoin?.(req.id, req.userId || '', req.ministryId);
    } catch (e: any) {
      console.error('[MembersScreen] Erro ao recusar solicitação:', e);
      addToast(e?.message || 'Erro ao recusar solicitação.', 'error');
    } finally {
      setApprovingId(null);
    }
  };

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

        {visibleRequests.length > 0 && (
            <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 rounded-2xl p-6 mb-8 shadow-sm animate-fade-in">
                <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                        <UserPlus className="text-amber-600 dark:text-amber-400" size={20}/>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                            Solicitações de Entrada ({visibleRequests.length})
                        </h3>
                    </div>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                        Aguardando aprovação
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleRequests.map((req: any) => {
                        const isOtherMinistry = req.ministryId && req.ministryId !== currentUser.ministryId;
                        const isProcessing = approvingId === req.id;
                        const manualId = manualSelections[req.id];
                        const selectedManual = manualId ? orgCandidates.find(c => c.id === manualId) : null;
                        const resolved = resolvedProfiles[req.id] || (selectedManual ? { userId: selectedManual.id, name: selectedManual.name, email: selectedManual.email, avatarUrl: selectedManual.avatar_url } : null);
                        
                        const effectiveUserId = req.userId || resolved?.userId;
                        const displayName = resolved?.name || req.userName || resolved?.email || req.userEmail || 'Membro Solicitante';
                        const displayEmail = resolved?.email || req.userEmail || '';
                        const avatarUrl = resolved?.avatarUrl;
                        const initial = (displayName || '?').charAt(0).toUpperCase();

                        return (
                            <div key={req.id} className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col gap-3 transition-all hover:border-amber-500/40">
                                <div className="flex justify-between items-start gap-3">
                                    {/* Avatar */}
                                    {avatarUrl ? (
                                        <img 
                                            src={avatarUrl} 
                                            alt={displayName} 
                                            className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0" 
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-secondary to-secondaryHover flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-inner">
                                            {initial}
                                        </div>
                                    )}

                                    {/* Informações Principais */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                                                {displayName}
                                            </p>
                                            {isOtherMinistry && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-secondary/10 text-secondary dark:text-amber-400 rounded-md">
                                                    Para: {req.ministryName}
                                                </span>
                                            )}
                                        </div>
                                        {displayEmail && (
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5 truncate">
                                                <Mail size={12} className="shrink-0 text-zinc-400" />
                                                <span className="truncate">{displayEmail}</span>
                                            </p>
                                        )}
                                        <p className="text-[11px] text-zinc-400 mt-0.5">
                                            {new Date(req.timestamp).toLocaleString('pt-BR')}
                                        </p>
                                    </div>

                                    {/* Ações */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button 
                                            onClick={() => handleRejectJoin(req)}
                                            disabled={isProcessing}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                            title="Recusar solicitação"
                                        >
                                            <X size={18}/>
                                        </button>
                                        <button 
                                            onClick={() => handleApproveJoin(req)}
                                            disabled={isProcessing}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 shadow-sm"
                                            title="Aprovar e adicionar ao ministério"
                                        >
                                            {isProcessing ? (
                                                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <Check size={14}/>
                                            )}
                                            Aprovar
                                        </button>
                                    </div>
                                </div>

                                {/* Mensagem da Notificação / Contexto original */}
                                {req.rawMessage && (
                                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-700/40 border border-zinc-100 dark:border-zinc-700/50 text-[11px] text-zinc-600 dark:text-zinc-300 italic">
                                        "{req.rawMessage}"
                                    </div>
                                )}

                                {/* Se o ID do membro não estiver definido, permite vincular diretamente a um membro da igreja */}
                                {!effectiveUserId && orgCandidates.length > 0 && (
                                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-col gap-1 text-xs">
                                        <label className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                            Vincular a um membro da organização para aprovar:
                                        </label>
                                        <select
                                            value={manualSelections[req.id] || ''}
                                            onChange={(e) => setManualSelections(prev => ({ ...prev, [req.id]: e.target.value }))}
                                            className="w-full text-xs bg-white dark:bg-zinc-800 border border-amber-500/40 rounded-lg p-1.5 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="">Selecione o membro...</option>
                                            {orgCandidates.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name || 'Sem Nome'} {c.email ? `(${c.email})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {req.roles && req.roles.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-700/50">
                                        <span className="text-[10px] text-zinc-400 self-center">Funções desejadas:</span>
                                        {req.roles.map((r: string) => (
                                            <span key={r} className="text-[10px] font-medium px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded">
                                                {r}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-700/50">
                                        Entrada geral (sem funções pré-definidas)
                                    </p>
                                )}
                            </div>
                        );
                    })}
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
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 flex flex-row relative group shadow-sm hover:shadow-md transition-all hover:border-zinc-300 dark:hover:border-zinc-700 animate-slide-up h-full gap-4">
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