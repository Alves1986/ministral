import { getSupabase, serviceOrgId } from './client';
import { TeamMemberProfile, SwapRequest } from '../../types';
import { notifySuperAdmins, sendNotificationSQL } from './notifications';

export const fetchSwapRequests = async (ministryId: string, orgId: string): Promise<SwapRequest[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('swap_requests')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('status', 'pending');
    
    if (!data) return [];
    
    return data.map(req => ({
        id: req.id,
        ministryId: req.ministry_id,
        requesterName: req.requester_name,
        requesterId: req.requester_id,
        role: req.role,
        eventIso: req.event_datetime,
        eventTitle: req.event_title,
        status: req.status,
        createdAt: req.created_at,
        takenByName: req.taken_by_name,
        reason: req.reason,
        origin: req.origin,
    }));
};

export const createSwapRequestSQL = async (ministryId: string, orgId: string, request: Partial<SwapRequest>) => {
    const sb = getSupabase();
    if (!sb) return;

    // Previne duplicação de pedidos para a mesma vaga
    const { data: existing } = await sb.from('swap_requests')
        .select('id')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('requester_id', request.requesterId)
        .eq('role', request.role)
        .eq('event_datetime', request.eventIso)
        .eq('status', 'pending')
        .maybeSingle();

    if (existing) {
        throw new Error("Você já possui uma solicitação pendente para esta vaga.");
    }

    // Retorna o ID para passar à Edge Function de notificação
    const { data: inserted, error } = await sb.from('swap_requests').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        requester_id: request.requesterId,
        requester_name: request.requesterName,
        role: request.role,
        event_datetime: request.eventIso,
        event_title: request.eventTitle,
        status: 'pending'
    }).select('id').single();

    if (error) {
        console.error("Error creating swap request:", error);
        throw error;
    }

    // Notificar o solicitante que seu pedido foi enviado (push + in-app)
    if (request.requesterId) {
        sendNotificationSQL(ministryId, orgId, {
            title: 'Pedido de Troca Enviado',
            message: `Seu pedido de troca para "${request.eventTitle}" foi enviado. Aguardando voluntário.`,
            type: 'info',
            actionLink: 'swaps',
            targetUserId: request.requesterId
        }).catch(() => {});
    }

    // Notificar os membros do ministério que há um pedido de troca disponível
    sendNotificationSQL(ministryId, orgId, {
        title: '🔄 Novo Pedido de Troca de Escala',
        message: `${request.requesterName} solicitou troca na função "${request.role}" para "${request.eventTitle}". Clique para ver ou assumir a vaga.`,
        type: 'warning',
        actionLink: 'swaps'
    }).catch(() => {});

    // Notifica admins no app
    await notifySuperAdmins(
        'Novo Pedido de Troca',
        `O usuário ${request.requesterName} solicitou uma troca para o evento "${request.eventTitle}".`,
        'swaps',
        ministryId
    );
};

export interface SwapAssignmentCandidate {
    id: string;
    event_rule_id?: string | null;
    member_id?: string | null;
    profiles?: any;
}

export interface SwapRuleHour {
    id: string;
    time?: string | null;
}

/**
 * Seleciona o assignment correto para processar uma troca de escala.
 * O schedule_assignments não guarda a hora do evento — só event_date + role.
 * Quando há MAIS DE UM culto no mesmo dia com a mesma função (ex: 2 cultos),
 * a desambiguação usa o horário do evento (event_rules.time) casado com a
 * hora presente no event_datetime do pedido de troca.
 *
 * Ordem:
 *  1. Escalas do próprio solicitante (member_id) — 1 só = vaga certa
 *  2. Várias do mesmo membro -> casa event_rules.time com a hora do evento
 *  3. Nenhuma do membro -> tenta pelo nome
 *  4. Candidato único (último recurso)
 */
export const pickSwapAssignment = (
    candidates: SwapAssignmentCandidate[],
    requesterId: string,
    requesterName: string,
    timePart: string,
    rules: SwapRuleHour[],
): SwapAssignmentCandidate | null => {
    if (!candidates || candidates.length === 0) return null;

    // 1. Escalas do próprio solicitante
    const byId = candidates.filter((c) => c.member_id === requesterId);

    // 2. Uma só: é a vaga certa
    if (byId.length === 1) return byId[0];

    // 3. Várias do mesmo membro no mesmo dia+role (ex: 2 cultos): desambigua pela hora
    if (byId.length > 1) {
        const ruleForHour = rules.find((r) => (r.time || "").substring(0, 5) === timePart);
        if (ruleForHour) {
            const matched = byId.find((c) => c.event_rule_id === ruleForHour.id);
            if (matched) return matched;
        }
        return byId[0]; // último recurso: qualquer uma do membro
    }

    // 4. Nenhuma do membro: tenta pelo nome associado
    const byName = candidates.find((c) => {
        const profileName = Array.isArray(c.profiles) ? c.profiles[0]?.name : c.profiles?.name;
        return profileName === requesterName;
    });
    if (byName) return byName;

    // 5. Candidato único (último recurso)
    if (candidates.length === 1) return candidates[0];

    return null;
};

export const performSwapSQL = async (ministryId: string, orgId: string, reqId: string, takenByName: string, takenById: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const { data: req, error: reqError } = await sb.from('swap_requests').select('*').eq('id', reqId).eq('organization_id', orgId).single();
    if (reqError) {
        console.error('[performSwapSQL] Erro ao buscar swap_request:', reqError);
        throw new Error(`Pedido de troca não encontrado: ${reqError.message}`);
    }
    if (!req) {
        throw new Error('Pedido de troca não encontrado.');
    }
    
    // event_datetime is a timestamp, e.g., "2026-04-03T12:00:00"
    const datePart = req.event_datetime.split('T')[0];
    const timePart = (req.event_datetime.split('T')[1] || "").substring(0, 5); // HH:MM

    console.log(`[performSwapSQL] Processando troca: reqId=${reqId}, role=${req.role}, datePart=${datePart}, timePart=${timePart}, requester_id=${req.requester_id}, takenById=${takenById}`);

    // Busca assignments apenas por data e role
    const { data: assignments, error: fetchErr } = await sb.from('schedule_assignments')
        .select('*, profiles(name)')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('event_date', datePart)
        .eq('role', req.role);

    if (fetchErr) {
        console.error('[performSwapSQL] Erro ao buscar schedule_assignments:', fetchErr);
        throw new Error(`Erro ao buscar escala: ${fetchErr.message}`);
    }

    console.log(`[performSwapSQL] Assignments encontrados para role=${req.role} em ${datePart}: ${assignments?.length || 0}`);

    // Se houver múltiplos candidatos no mesmo dia+role, carrega as regras para
    // desambiguar pelo horário do evento (permitido que o membro esteja em 2+ cultos).
    let rulesForSwap: SwapRuleHour[] = [];
    if (assignments && assignments.length > 1) {
        const ruleIds = [...new Set(assignments.map((a: any) => a.event_rule_id).filter(Boolean))];
        if (ruleIds.length > 0) {
            const { data: rules, error: rulesErr } = await sb
                .from('event_rules')
                .select('id, time')
                .eq('organization_id', orgId)
                .eq('ministry_id', ministryId)
                .in('id', ruleIds);
            if (rulesErr) {
                console.error('[performSwapSQL] Erro ao buscar event_rules para desambiguação:', rulesErr);
            } else {
                rulesForSwap = rules || [];
            }
        }
    }

    const assignment = pickSwapAssignment(
        (assignments || []) as SwapAssignmentCandidate[],
        req.requester_id,
        req.requester_name,
        timePart,
        rulesForSwap
    );
        
    if (assignment) {
        console.log(`[performSwapSQL] Assignment encontrado: id=${assignment.id}, member_id=${assignment.member_id}`);
        
        const { error: errorAssignment } = await sb.from('schedule_assignments').update({
            member_id: takenById,
            confirmed: false
        }).eq('id', assignment.id);
        
        if (errorAssignment) {
            console.error('[performSwapSQL] Erro atualizando schedule_assignments:', errorAssignment);
            throw new Error(`Falha ao atualizar escala: ${errorAssignment.message} (code: ${errorAssignment.code})`);
        }

        console.log(`[performSwapSQL] schedule_assignments atualizado. Atualizando swap_requests...`);

        // Atualiza TODAS as requisições duplicadas (caso existam) para esta mesma vaga
        const { error: errorSwap } = await sb.from('swap_requests').update({
            status: 'completed',
            taken_by_id: takenById,
            taken_by_name: takenByName,
            taken_at: new Date().toISOString()
        })
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('requester_id', req.requester_id)
        .eq('role', req.role)
        .eq('event_datetime', req.event_datetime)
        .eq('status', 'pending');
        
        if (errorSwap) {
            console.error('[performSwapSQL] Erro atualizando swap_requests:', errorSwap);
            throw new Error(`Falha ao concluir o pedido de troca: ${errorSwap.message} (code: ${errorSwap.code})`);
        }
        
        console.log(`[performSwapSQL] Troca concluída com sucesso para reqId=${reqId}`);

        // Notificar o solicitante original que sua troca foi aceita
        sendNotificationSQL(ministryId, orgId, {
            title: 'Troca Aceita!',
            message: `${takenByName} assumiu sua escala de "${req.event_title}" no dia ${datePart.split('-').reverse().join('/')}.`,
            type: 'success',
            actionLink: 'swaps',
            targetUserId: req.requester_id
        }).catch(() => {});

        // Notificar admins que a troca foi concluída
        notifySuperAdmins(
            'Troca Concluída',
            `${takenByName} assumiu a escala de ${req.requester_name} para "${req.event_title}".`,
            'swaps',
            ministryId
        ).catch(() => {});
    } else {
        const errorMsg = `[performSwapSQL] Assignment nao encontrado para o swap: ${reqId} (role: ${req.role}, requester_id: ${req.requester_id}, datePart: ${datePart}, timePart: ${timePart})`;
        console.error(errorMsg);

        // NÃO marcar o swap como completed sem efetivamente trocar ninguém.
        // Isso era um "falso sucesso" silencioso: o membro via "Escala assumida"
        // mas a escala original permanecia com o mesmo voluntário.
        throw new Error("Não foi possível localizar a escala original para processar a troca. A vaga não foi alterada.");
    }
};


export const cancelSwapRequestSQL = async (reqId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from('swap_requests').update({ status: 'cancelled' }).eq('id', reqId).eq('organization_id', orgId);
    if (error) {
        console.error('[cancelSwapRequestSQL] Erro:', error);
        throw new Error('Falha ao cancelar o pedido de troca.');
    }
};

export const updateMemberData = async (memberId: string, orgId: string, data: Partial<TeamMemberProfile> & { ministryId?: string; roles?: string[] }) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const profileUpdates: Partial<TeamMemberProfile> = {};
    if (data.name) profileUpdates.name = data.name;
    if (data.whatsapp) profileUpdates.whatsapp = data.whatsapp;
    
    if (Object.keys(profileUpdates).length > 0) {
        await sb.from('profiles').update(profileUpdates).eq('id', memberId).eq('organization_id', orgId);
    }
    
    // Aceitar tanto ministry_functions (EditMemberModal) quanto roles (legado)
    const functionsToSave = data.ministry_functions || data.roles;
    if (functionsToSave && data.ministryId) {
        await sb.from('ministry_members')
            .update({ functions: functionsToSave })
            .eq('profile_id', memberId)
            .eq('ministry_id', data.ministryId);
    }
};

export const deleteMember = async (ministryId: string, orgId: string, memberId: string, memberName: string) => {
    const sb = getSupabase();
    if (!sb) return;

    await sb.from('ministry_members')
        .delete()
        .eq('ministry_id', ministryId)
        .eq('profile_id', memberId);
};

export const toggleAdminSQL = async (email: string, isAdmin: boolean, ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;

    // Obter dados do usuário logado para verificar permissão
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const { data: currentUserProfile } = await sb.from('profiles')
        .select('name, is_admin, is_super_admin, organization_id')
        .eq('id', user.id)
        .maybeSingle();

    // Segurança: Apenas admins da mesma org ou super admins podem alterar status de admin
    if (!currentUserProfile?.is_super_admin && (!currentUserProfile?.is_admin || currentUserProfile?.organization_id !== orgId)) {
        console.error('[toggleAdminSQL] Acesso negado: Usuário não tem permissão.');
        return;
    }

    const authorName = currentUserProfile?.name || user?.email || 'Sistema';

    // Atualizar profiles.is_admin
    await sb.from('profiles')
        .update({ is_admin: isAdmin })
        .eq('email', email)
        .eq('organization_id', orgId);

    // Buscar o profile_id pelo email para atualizar ministry_members.role
    const { data: targetProfile } = await sb.from('profiles')
        .select('id')
        .eq('email', email)
        .eq('organization_id', orgId)
        .maybeSingle();

    if (targetProfile?.id) {
        await sb.from('ministry_members')
            .update({ role: isAdmin ? 'admin' : 'member' })
            .eq('profile_id', targetProfile.id)
            .eq('ministry_id', ministryId);
    }
};

export const fetchUserMinistryAccess = async (userId: string, ministryId: string, orgId?: string): Promise<{ functions: string[], role: string }> => {
  const sb = getSupabase();
  if (!sb || !orgId) return { functions: [], role: 'member' };

  const { data } = await sb
    .from('ministry_members')
    .select('functions, role')
    .eq('profile_id', userId)
    .eq('ministry_id', ministryId)
    .maybeSingle();

  return {
      functions: (data && Array.isArray(data.functions)) ? data.functions : [],
      role: data?.role || 'member'
  };
};



export const filterRolesBySettings = async (roles: string[], ministryId: string, orgId: string): Promise<string[]> => {
    const sb = getSupabase();
    if (!sb) return roles;

    if (!roles || roles.length === 0) return [];

    const { data: settings } = await sb.from('ministry_settings')
        .select('roles')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();

    const dbRoles = settings?.roles;

    if (!dbRoles || !Array.isArray(dbRoles) || dbRoles.length === 0) {
        return roles;
    }

    return roles.filter(r => dbRoles.includes(r));
};

export const fetchMinistryMembers = async (ministryId: string, orgId?: string) => {
  const sb = getSupabase();
  if (!sb || !orgId) return { memberMap: {}, publicList: [] };

  // 0. Verificar se o usuário logado é admin para decidir quais dados retornar
  const { data: { user: authUser } } = await sb.auth.getUser();
  const { data: requesterProfile } = authUser 
    ? await sb.from('profiles').select('is_admin, is_super_admin').eq('id', authUser.id).maybeSingle()
    : { data: null };
  
  const isRequesterAdmin = requesterProfile?.is_admin || requesterProfile?.is_super_admin;

  // 1. Buscar os vínculos
  const { data: memberships, error: memError } = await sb
    .from('ministry_members')
    .select('*')
    .eq('ministry_id', ministryId);

  if (memError) {
    console.error("[fetchMinistryMembers] Error fetching memberships:", memError);
    throw memError;
  }

  const memberMap: Record<string, string[]> = {};
  const publicList: TeamMemberProfile[] = [];

  if (!memberships || memberships.length === 0) {
      console.log(`[fetchMinistryMembers] No members found for ministry ${ministryId}`);
      return { memberMap, publicList };
  }

  // 2. Buscar os perfis correspondentes
  const profileIds = memberships.map(m => m.profile_id).filter(Boolean);
  
  let profilesData: any[] = [];
  if (profileIds.length > 0) {
      const { data: profiles, error: profError } = await sb
        .from('profiles')
        .select('*')
        .in('id', profileIds);
        
      if (profError) {
          console.error("[fetchMinistryMembers] Error fetching profiles:", profError);
      } else if (profiles) {
          profilesData = profiles;
      }
  }

  // 3. Mesclar os dados
  memberships.forEach((m: any) => {
    const p = profilesData.find(prof => prof.id === m.profile_id);
    
    if (!p) {
        console.warn(`[fetchMinistryMembers] Member ${m.profile_id} has no accessible profile`);
        publicList.push({
          id: m.profile_id,
          name: "Membro em Processo",
          email: "",
          avatar_url: "",
          whatsapp: "",
          birthDate: "",
          isAdmin: m.role === 'admin',
          ministry_functions: Array.isArray(m.functions) ? m.functions : [],
        });
        return;
    }

    // Se orgId for fornecido, garantimos que o membro pertence a essa organização
    if (orgId && p.organization_id && p.organization_id !== orgId) {
        return;
    }

    const rawFunctions = Array.isArray(m.functions) ? m.functions : [];
    const cleanFunctions = rawFunctions.filter((r: string) => !r.startsWith('__vocal_count:') && !r.startsWith('__dance_count:'));
    
    const isSelf = authUser?.id === p.id;
    const canSeePII = isRequesterAdmin || isSelf;

    publicList.push({
      id: p.id,
      name: p.name || "Sem Nome",
      email: canSeePII ? (p.email || "") : "",
      avatar_url: p.avatar_url,
      whatsapp: canSeePII ? p.whatsapp : "",
      birthDate: canSeePII ? p.birth_date : "",
      isAdmin: p.is_admin || m.role === 'admin',
      ministry_functions: cleanFunctions,
    });

    cleanFunctions.forEach((role: string) => {
      if (!memberMap[role]) memberMap[role] = [];
      memberMap[role].push(p.name || "Sem Nome");
    });
  });

  return { memberMap, publicList };
};

export const updateProfileMinistry = async (userId: string, ministryId: string, orgId?: string) => {
    const sb = getSupabase();
    const finalOrgId = orgId || serviceOrgId;
    if (!sb || !finalOrgId) {
        console.warn('[updateProfileMinistry] Missing Supabase client or orgId');
        return;
    }
    await sb.from('profiles').update({ ministry_id: ministryId })
        .eq('id', userId)
        .eq('organization_id', finalOrgId);
};

export const fetchMemberScheduleHistory = async (
  userId: string,
  ministryId: string,
  orgId: string,
  limitMonths: number = 3
) => {
  const sb = getSupabase();
  if (!sb) return [];
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - limitMonths);
  const { data } = await sb
    .from('schedule_assignments')
    .select('event_date, role, confirmed, event_rules(title, time)')
    .eq('organization_id', orgId)
    .eq('ministry_id', ministryId)
    .eq('member_id', userId)
    .gte('event_date', cutoff.toISOString().slice(0, 10))
    .order('event_date', { ascending: false });
  return data || [];
};
