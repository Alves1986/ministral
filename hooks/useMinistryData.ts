import { useEffect, useMemo, useCallback } from 'react';
import { User, Role, DEFAULT_ROLES } from '../types';
import { useMinistryQueries, keys } from './useMinistryQueries';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../services/supabaseService';
import { useAppStore } from '../store/appStore';
import { useEvents } from '../application/useEvents';

export function useMinistryData(ministryId: string | null, currentMonth: string, currentUser: User | null) {
  const mid = ministryId || ''; 
  const orgId = currentUser?.organizationId || '';
  
  // Custom Availability Query using V2 (ID-Based)
  const queryClient = useQueryClient();

  const {
    settingsQuery,
    assignmentsQuery,
    membersQuery,
    notificationsQuery,
    announcementsQuery,
    swapsQuery,
    repertoireQuery,
    conflictsQuery,
    rulesQuery,
    nextEventQuery,
    availabilityV2Query,
    isLoading: isLoadingQueries
  } = useMinistryQueries(mid, currentMonth, currentUser);

  const availabilityV2 = useMemo(() => 
    availabilityV2Query.data || { availability: {}, notes: {} }, 
    [availabilityV2Query.data]
  );

  // Transform ID-based availability to Name-based for legacy components
  const availabilityByName = useMemo(() => {
      const map: Record<string, string[]> = {};
      const membersList = membersQuery.data?.publicList || [];
      
      Object.entries(availabilityV2.availability).forEach(([userId, dates]) => {
          const member = membersList.find(m => m.id === userId);
          if (member) {
              map[member.name] = dates;
          }
      });
      return map;
  }, [availabilityV2, membersQuery.data]);

  // Note: availabilityNotes uses "UserID_Month" key. We need to map it to "Name_Month" for legacy if needed, 
  // but AvailabilityScreen now uses IDs, so legacy mapping might only be needed if ScheduleTable uses notes by name.
  // ScheduleTable logic currently uses `getMemberNote` via name.
  const notesByName = useMemo(() => {
      const map: Record<string, string> = {};
      const membersList = membersQuery.data?.publicList || [];
      
      Object.entries(availabilityV2.notes).forEach(([key, value]) => {
          // Key format: UserID_YYYY-MM-00
          const parts = key.split('_');
          const userId = parts[0];
          const datePart = parts.slice(1).join('_');
          
          const member = membersList.find(m => m.id === userId);
          if (member) {
              map[`${member.name}_${datePart}`] = value;
          }
      });
      return map;
  }, [availabilityV2, membersQuery.data]);


  // CÁLCULO DE DATAS PARA O USEEVENTS (Regras de projeção)
  const [yearStr, monthStr] = currentMonth.split('-');
  const year = parseInt(yearStr);
  const monthIndex = parseInt(monthStr) - 1;
  const startDate = `${currentMonth}-01`;
  const endDate = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0]; // Último dia do mês

  // Projeção baseada em regras (apenas para fallback e editor)
  const { events: generatedEvents, isLoading: isLoadingEvents } = useEvents({
      ministryId: mid,
      organizationId: orgId,
      startDate,
      endDate
  });

  const { setMinistryId, availableMinistries } = useAppStore();

  useEffect(() => {
    // Evita verificações se o usuário for superadmin ou se não houver ID válido
    if (!mid || mid.length !== 36 || !currentUser || currentUser.isSuperAdmin) return;

    if (currentUser.allowedMinistries) {
        const hasAccess = currentUser.allowedMinistries.includes(mid);
        
        if (!hasAccess && currentUser.allowedMinistries.length > 0) {
            // Pequeno delay para permitir que o Profile/Store sincronize durante trocas rápidas
            const timeout = setTimeout(() => {
                // Re-checa o estado atualizado do store
                const currentAllowed = currentUser?.allowedMinistries;
                if (currentAllowed && !currentAllowed.includes(mid)) {
                    console.warn(`[useMinistryData] Acesso restrito ao ministério ${mid}. Redirecionando...`);
                    const fallback = currentAllowed[0];
                    if (fallback) setMinistryId(fallback);
                }
            }, 800);
            return () => clearTimeout(timeout);
        }
    }
  }, [mid, currentUser?.id, currentUser?.allowedMinistries, setMinistryId]);

  const foundMinistry = availableMinistries.find(m => m.id === mid);
  const ministryTitle = settingsQuery.data?.displayName || foundMinistry?.label || (mid.length === 36 ? 'Carregando...' : (mid ? 'Ministério' : 'Selecione um Ministério'));
  
  const rawRoles: string[] = useMemo(() => {
      let r = settingsQuery.data?.roles || [];
      if (r.length === 0 && mid) {
          const ministryDef = availableMinistries.find(m => m.id === mid);
          const code = ministryDef?.code || '';
          r = DEFAULT_ROLES[code] || DEFAULT_ROLES['default'] || [];
      }
      return r;
  }, [settingsQuery.data, mid, availableMinistries]);

  const cleanRoles = useMemo(() => {
      return rawRoles.filter(r => !r.startsWith('__vocal_count:'));
  }, [rawRoles]);

  const expandedRoles = useMemo(() => {
      const vocalCountMatch = rawRoles.find(r => r.startsWith('__vocal_count:'));
      let vocalCount = vocalCountMatch ? parseInt(vocalCountMatch.split(':')[1]) : 1;
      
      // Fallback para ministério de louvor (legado/padrão)
      if (vocalCount === 1 && (mid === 'louvor' || foundMinistry?.code === 'louvor')) {
          vocalCount = 5;
      }
      
      return cleanRoles.flatMap(role => {
          if (role === 'Vocal' && vocalCount > 1) {
              return Array.from({ length: vocalCount }, (_, i) => `Vocal ${i + 1}`);
          }
          return [role];
      });
  }, [rawRoles, cleanRoles, mid, foundMinistry]);

  const availabilityWindow = useMemo(() => ({
      start: settingsQuery.data?.availabilityStart,
      end: settingsQuery.data?.availabilityEnd
  }), [settingsQuery.data]);

  const integrations = useMemo(() => ({
      spotifyClientId: settingsQuery.data?.spotifyClientId,
      spotifyClientSecret: settingsQuery.data?.spotifyClientSecret,
      youtubeApiKey: settingsQuery.data?.youtubeApiKey,
      qrCodeUrl: settingsQuery.data?.qrCodeUrl,
      socialLinkUrl: settingsQuery.data?.socialLinkUrl,
      quickAccessItems: settingsQuery.data?.quickAccessItems
  }), [settingsQuery.data]);

  const refreshData = useCallback(async () => {
      // Invalida o cache para todas as queries relevantes.
      // Usa refetchType: 'active' para só re-buscar queries com observers ativos
      // (aba visível), evitando re-renders e flashes desnecessários em abas ocultas.
      queryClient.invalidateQueries({ 
          refetchType: 'active',
          predicate: (query) => 
              query.queryKey[0] === 'event_rules' || 
              query.queryKey[0] === 'settings' || 
              query.queryKey[0] === 'members' ||
              query.queryKey[0] === 'conflicts' ||
              query.queryKey[0] === 'assignments' ||
              query.queryKey[0] === 'rules' ||
              query.queryKey[0] === 'swaps' ||
              query.queryKey[0] === 'repertoire' ||
              query.queryKey[0] === 'availability' ||
              query.queryKey[0] === 'availabilityV2' ||
              query.queryKey[0] === 'nextEvent' ||
              query.queryKey[0] === 'announcements' ||
              query.queryKey[0] === 'notifications' ||
              query.queryKey[0] === 'ranking'
      });
  }, [queryClient]);

  const userId = currentUser?.id ?? '';
  const allowedMids = useMemo(() => {
      return currentUser?.allowedMinistries ?? (mid ? [mid] : []);
  }, [currentUser?.allowedMinistries, mid]);
  const isAdminFlag = !!(currentUser?.access_role === 'admin' || currentUser?.isOrgAdmin || currentUser?.isSuperAdmin);

  // 1. Canais que NÃO dependem do mês (Estáveis)
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !mid || !orgId) return;
    if (mid.length !== 36) return;

    const channel = sb.channel(`ministry-base-live-${mid}`);

    channel
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'event_rules', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: ['event_rules', mid, orgId] });
                queryClient.invalidateQueries({ queryKey: keys.rules(mid, orgId) });
                queryClient.invalidateQueries({ queryKey: keys.nextEvent(mid, orgId) });
            }
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'member_availability', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.availabilityV2(mid, orgId) });
            }
        )
        .on(
            'postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ 
                    queryKey: keys.notifications(
                        allowedMids, 
                        userId, 
                        orgId,
                        isAdminFlag
                    ) 
                });
            }
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'swap_requests', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.swapRequests(mid, orgId) });
            }
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'ministry_settings', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.settings(mid, orgId) });
            }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'announcements', filter: `ministry_id=eq.${mid}` },
          () => { queryClient.invalidateQueries({ queryKey: keys.announcements(mid, orgId) }); }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'ministry_members', filter: `ministry_id=eq.${mid}` },
          () => { queryClient.invalidateQueries({ queryKey: keys.members(mid, orgId) }); }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'repertoire_items', filter: `ministry_id=eq.${mid}` },
          () => { queryClient.invalidateQueries({ queryKey: keys.repertoire(mid, orgId) }); }
        )
        .subscribe();

    return () => {
        sb.removeChannel(channel);
    };
  }, [mid, queryClient, orgId, allowedMids, userId, isAdminFlag]);

  // 2. Canais que dependem do mês (Dinâmicos)
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !mid || !currentMonth) return;
    if (mid.length !== 36) return;

    const channel = sb.channel(`ministry-month-live-${mid}-${currentMonth}`);

    channel
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'schedule_assignments', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.assignments(mid, currentMonth, orgId) });
                queryClient.invalidateQueries({ queryKey: keys.nextEvent(mid, orgId) });
            }
        )
        .subscribe();

    return () => {
        sb.removeChannel(channel);
    };
  }, [mid, currentMonth, queryClient, orgId]);

  const events = useMemo(() => {
    const schedule = assignmentsQuery.data?.schedule || {};
    return generatedEvents
      .filter(gen => {
          // Chave de exclusão: ruleId|date|role
          const exclusionKey = `${gen.ruleId}|${gen.date}|__EVENT_EXCLUDED__`;
          return !schedule[exclusionKey];
      })
      .map(gen => ({
          id: gen.id,
          iso: gen.iso,
          title: gen.title,
          date: gen.date,
          time: gen.time,
          dateDisplay: gen.date.split('-').reverse().slice(0, 2).join('/')
      })).sort((a, b) => a.iso.localeCompare(b.iso));
  }, [generatedEvents, assignmentsQuery.data]);

  const eventRules = useMemo(() => {
      return (rulesQuery.data || []).filter(r => r.type === 'weekly');
  }, [rulesQuery.data]);

  return useMemo(() => ({
    events,
    roles: cleanRoles,
    rawRoles,
    expandedRoles,
    schedule: assignmentsQuery.data?.schedule || {}, 
    attendance: assignmentsQuery.data?.attendance || {}, 
    membersMap: membersQuery.data?.memberMap || {},
    publicMembers: membersQuery.data?.publicList || [],
    availability: availabilityV2.availability, // ID-Based
    availabilityNotes: availabilityV2.notes, // ID-Based
    availabilityByName, // LEGACY Support Name-Based
    notesByName, // LEGACY Support Name-Based
    notifications: notificationsQuery.data || [],
    announcements: announcementsQuery.data || [],
    repertoire: repertoireQuery.data || [],
    swapRequests: swapsQuery.data || [],
    globalConflicts: conflictsQuery.data || {}, 
    eventRules, 
    nextEvent: nextEventQuery.data || null,
    ministryTitle,
    availabilityWindow,
    integrations,
    isLoading: (isLoadingQueries && !assignmentsQuery.data && !membersQuery.data) || isLoadingEvents,
    refreshData,
    setEvents: () => refreshData(), 
    setSchedule: () => refreshData(),
    setAttendance: () => refreshData(),
    setPublicMembers: () => refreshData(),
    setAvailability: () => refreshData(),
    setNotifications: (updated: any, shouldRefresh = true) => {
        if (Array.isArray(updated)) {
            queryClient.setQueriesData({ queryKey: ['notifications'] }, updated);
        }
        if (shouldRefresh) refreshData();
    },
    setRepertoire: () => refreshData(),
    setMinistryTitle: () => refreshData(),
    setAvailabilityWindow: () => refreshData()
  }), [
      events, cleanRoles, rawRoles, expandedRoles, assignmentsQuery.data, 
      membersQuery.data, availabilityV2, availabilityByName, notesByName, 
      notificationsQuery.data, announcementsQuery.data, repertoireQuery.data, 
      swapsQuery.data, conflictsQuery.data, eventRules, 
      nextEventQuery.data, ministryTitle, availabilityWindow, integrations, 
      isLoadingQueries, isLoadingEvents, refreshData, queryClient, mid, orgId, isAdminFlag, currentUser
  ]);
}
