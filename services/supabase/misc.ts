import { getSupabase, serviceOrgId } from './client';
import { TeamMemberProfile, SwapRequest, WhatsAppSettings } from '../../types';
import { notifySuperAdmins } from './notifications';

export const fetchWhatsAppSettings = async (orgId: string): Promise<WhatsAppSettings | null> => {
    const sb = getSupabase();
    if (!sb) return null;
    // Tenta organization_id primeiro; fallback para org_id durante migração
    const { data } = await sb.from('whatsapp_settings').select('*').eq('organization_id', orgId).maybeSingle();
    if (data) return data;
    const { data: fallback } = await sb.from('whatsapp_settings').select('*').eq('org_id', orgId).maybeSingle();
    return fallback || null;
};

export const upsertWhatsAppSettings = async (orgId: string, settings: Partial<WhatsAppSettings>) => {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from('whatsapp_settings').upsert({
        organization_id: orgId,
        enabled: settings.enabled ?? true,
        send_days_before: settings.send_days_before ?? 0,
        send_time: settings.send_time ?? '09:00:00'
    }, { onConflict: 'organization_id' });
    if (error) throw error;
};

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

    // Notifica membros com a mesma função via WhatsApp (não-bloqueante)
    if (inserted?.id) {
        sb.functions.invoke('whatsapp-swap-notify', {
            body: { swapRequestId: inserted.id, ministryId, orgId }
        }).catch(err => {
            console.warn('[createSwapRequestSQL] whatsapp-swap-notify falhou silenciosamente:', err);
        });
    }

    // Notifica admins no app
    await notifySuperAdmins(
        'Novo Pedido de Troca',
        `O usuário ${request.requesterName} solicitou uma troca para o evento "${request.eventTitle}".`,
        'swaps',
        ministryId
    );
};

export const performSwapSQL = async (ministryId: string, orgId: string, reqId: string, takenByName: string, takenById: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const { data: req } = await sb.from('swap_requests').select('*').eq('id', reqId).eq('organization_id', orgId).single();
    if (!req) return;
    
    // event_datetime is a timestamp, e.g., "2026-04-03T12:00:00"
    const datePart = req.event_datetime.split('T')[0];
    
    // Busca assignments apenas por data e role
    const { data: assignments, error: fetchErr } = await sb.from('schedule_assignments')
        .select('*, profiles(name)')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('event_date', datePart)
        .eq('role', req.role);
        
    let assignment = null;
    
    if (assignments && assignments.length > 0) {
        // Tenta achar pelo ID exato
        assignment = assignments.find(a => a.member_id === req.requester_id);
        
        // Fallback: Tenta achar pelo nome associado ou diretamente via schedule logic
        if (!assignment) {
            assignment = assignments.find(a => {
                const profileName = Array.isArray(a.profiles) ? a.profiles[0]?.name : a.profiles?.name;
                return profileName === req.requester_name;
            });
        }
        
        // Super Fallback: Se so tem UM assignment pra essa role nesse dia, usa ele!
        if (!assignment && assignments.length === 1) {
            assignment = assignments[0];
            console.warn(`[performSwapSQL] member_id mismatch mas só tem 1 vaga. Usando ela. req_id: ${req.requester_id}, found_id: ${assignment.member_id}`);
        }
    }
        
    if (assignment) {
        const { error: errorAssignment } = await sb.from('schedule_assignments').update({
            member_id: takenById,
            confirmed: false
        }).eq('id', assignment.id);
        
        if (errorAssignment) {
            console.error('[performSwapSQL] Erro atualizando schedule_assignments:', errorAssignment);
            throw new Error('Falha de permissão ou erro ao atualizar escala original.');
        }

        // Atualiza TODAS as requisições duplicadas (caso existam) para esta mesma vaga
        const { error: errorSwap } = await sb.from('swap_requests').update({
            status: 'completed',
            taken_by_id: takenById,
            taken_by_name: takenByName
        })
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('requester_id', req.requester_id)
        .eq('role', req.role)
        .eq('event_datetime', req.event_datetime)
        .eq('status', 'pending');
        

        if (errorSwap) {
            console.error('[performSwapSQL] Erro atualizando swap_requests:', errorSwap);
            throw new Error('Falha ao concluir o pedido de troca.');
        }
    } else {
        const errorMsg = `[performSwapSQL] Assignment nao encontrado para o swap: ${reqId} (role: ${req.role}, requester_id: ${req.requester_id}, datePart: ${datePart})`;
        console.error(errorMsg);
        throw new Error("Não foi possível encontrar a escala original para processar a troca.");
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
    const cleanFunctions = rawFunctions.filter((r: string) => !r.startsWith('__vocal_count:'));
    
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

// ── WhatsApp Scheduled Notifications (per-event) ──────────────────────

export const scheduleWhatsAppNotification = async (
  orgId: string,
  ministryId: string,
  eventRuleId: string,
  eventDate: string,
  eventTitle: string,
  scheduledAt: string,
  createdBy?: string
) => {
    const sb = getSupabase();
    if (!sb) return;

    // Remove agendamento anterior para o mesmo evento (se houver)
    await sb.from('whatsapp_scheduled_notifications')
        .delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('event_rule_id', eventRuleId)
        .eq('event_date', eventDate);

    const { error } = await sb.from('whatsapp_scheduled_notifications').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        event_rule_id: eventRuleId,
        event_date: eventDate,
        event_title: eventTitle,
        scheduled_at: scheduledAt,
        status: 'pending',
        created_by: createdBy || null
    });
    if (error) throw error;
};

export const cancelWhatsAppNotification = async (id: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from('whatsapp_scheduled_notifications')
        .delete()
        .eq('id', id);
    if (error) throw error;
};

export const fetchScheduledNotifications = async (
  orgId: string,
  ministryId: string
): Promise<{ id: string; event_rule_id: string; event_date: string; event_title: string; scheduled_at: string; status: string }[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('whatsapp_scheduled_notifications')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .order('scheduled_at', { ascending: true });
    return data || [];
};
