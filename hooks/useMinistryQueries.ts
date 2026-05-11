import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import * as Supabase from '../services/supabaseService';
import { fetchEventRules } from '../infra/supabase/fetchEventRules'; // Importação da Camada Infra
import { fetchNextEventCardData, saveAssignmentV2, removeAssignmentV2 } from '../services/scheduleServiceV2'; // New Service
import { toggleAssignmentConfirmation } from '../services/supabase/scales';
import { useAppStore } from '../store/appStore';
import { 
  MinistrySettings, 
  ScheduleMap, 
  AttendanceMap, 
  TeamMemberProfile, 
  AvailabilityMap, 
  AppNotification, 
  Announcement, 
  SwapRequest, 
  RepertoireItem, 
  GlobalConflictMap, 
  User
} from '../types';
import { EventRule } from '../domain/events/types';

// Keys for caching
export const keys = {
  settings: (mid: string, oid: string) => ['settings', mid, oid],
  assignments: (mid: string, month: string, oid: string) => ['assignments', mid, month, oid],
  rules: (mid: string, oid: string) => ['rules', mid, oid],
  members: (mid: string, oid: string) => ['members', mid, oid],
  availability: (mid: string, oid: string) => ['availability', mid, oid],
  notifications: (mids: string[], uid: string, oid: string, isAdmin: boolean) => ['notifications', { mids, uid, oid, isAdmin }],
  announcements: (mid: string, oid: string) => ['announcements', mid, oid],
  swapRequests: (mid: string, oid: string) => ['swaps', mid, oid],
  repertoire: (mid: string, oid: string) => ['repertoire', mid, oid],
  globalConflicts: (mid: string, month: string, oid: string) => ['conflicts', mid, month, oid],
  ranking: (mid: string, oid: string) => ['ranking', mid, oid],
  nextEvent: (mid: string, oid: string) => ['nextEvent', mid, oid],
  availabilityV2: (mid: string, oid: string) => ['availabilityV2', mid, oid]
};

// Dados que mudam raramente (10 minutos de cache)
const STALE_SLOW = 10 * 60 * 1000;

// Dados que mudam com frequencia media (2 minutos)
const STALE_MEDIUM = 2 * 60 * 1000;

// Dados em tempo real (5 minutos de cache, mas o realtime invalida quando muda)
// Aumentar o staleTime aqui evita refetches desnecessários se o realtime estiver funcionando
const STALE_REALTIME = 5 * 60 * 1000;

const GC_TIME = 15 * 60 * 1000;

export function useMinistryQueries(ministryId: string, currentMonth: string, user: User | null) {
  const queryClient = useQueryClient();
  const orgId = user?.organizationId || '';
  
  const isQueryEnabled = Boolean(ministryId && orgId);
  const isScheduleEnabled = Boolean(ministryId && orgId && currentMonth);

  const isAdmin = user?.access_role === 'admin' || user?.isOrgAdmin || user?.isSuperAdmin;

  // 1. Settings & Roles
  const settingsQuery: UseQueryResult<MinistrySettings | null> = useQuery({
    queryKey: keys.settings(ministryId, orgId),
    queryFn: () => Supabase.fetchMinistrySettings(ministryId, orgId),
    enabled: isQueryEnabled,
    staleTime: STALE_SLOW,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false
  });

  // 2. Assignments (Schedule Map)
  const assignmentsQuery: UseQueryResult<{ schedule: ScheduleMap; attendance: AttendanceMap }> = useQuery({
    queryKey: keys.assignments(ministryId, currentMonth, orgId),
    queryFn: () => Supabase.fetchScheduleAssignments(ministryId, currentMonth, orgId),
    enabled: isScheduleEnabled,
    staleTime: STALE_REALTIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false
  });

  // 3. Members
  const membersQuery: UseQueryResult<{ memberMap: Record<string, string[]>; publicList: TeamMemberProfile[] }> = useQuery({
    queryKey: keys.members(ministryId, orgId),
    queryFn: () => Supabase.fetchMinistryMembers(ministryId, orgId),
    enabled: isQueryEnabled,
    staleTime: STALE_REALTIME, // Reduzido para garantir visibilidade de novos membros
    gcTime: GC_TIME,
    refetchOnWindowFocus: false
  });

  // 4. Availability
  const availabilityQuery: UseQueryResult<{ availability: Record<string, string[]>; notes: Record<string, string> }> = useQuery({
    queryKey: keys.availability(ministryId, orgId),
    queryFn: () => Supabase.fetchMinistryAvailability(ministryId, orgId),
    enabled: false,
    staleTime: STALE_REALTIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false
  });

  // 5. Notifications
  const notificationsQuery: UseQueryResult<AppNotification[]> = useQuery({
    queryKey: keys.notifications(user?.allowedMinistries || (ministryId ? [ministryId] : []), user?.id || '', orgId, !!isAdmin),
    queryFn: () => {
      const mids = user?.allowedMinistries || (ministryId ? [ministryId] : []);
      return Supabase.fetchNotificationsSQL(mids, user?.id || '', orgId, !!isAdmin);
    },
    enabled: Boolean(user?.id && orgId),
    staleTime: STALE_MEDIUM,
    gcTime: GC_TIME
  });

  // 6. Announcements
  const announcementsQuery: UseQueryResult<Announcement[]> = useQuery({
    queryKey: keys.announcements(ministryId, orgId),
    queryFn: () => Supabase.fetchAnnouncementsSQL(ministryId, orgId),
    enabled: isQueryEnabled,
    staleTime: STALE_MEDIUM,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false
  });

  // 7. Swap Requests
  const swapsQuery: UseQueryResult<SwapRequest[]> = useQuery({
    queryKey: keys.swapRequests(ministryId, orgId),
    queryFn: () => Supabase.fetchSwapRequests(ministryId, orgId),
    enabled: isQueryEnabled,
    staleTime: STALE_MEDIUM,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false
  });

  // 8. Repertoire
  const repertoireQuery: UseQueryResult<RepertoireItem[]> = useQuery({
    queryKey: keys.repertoire(ministryId, orgId),
    queryFn: () => Supabase.fetchRepertoire(ministryId, orgId),
    enabled: isQueryEnabled,
    staleTime: STALE_SLOW,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false
  });

  // 9. Global Conflicts
  const conflictsQuery: UseQueryResult<GlobalConflictMap> = useQuery({
    queryKey: keys.globalConflicts(ministryId, currentMonth, orgId),
    queryFn: () => Supabase.fetchGlobalSchedules(currentMonth, ministryId, orgId),
    enabled: isScheduleEnabled,
    staleTime: STALE_REALTIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false
  });

  // 11. Rules (New) - Agora usa a camada de infra correta
  const rulesQuery: UseQueryResult<EventRule[]> = useQuery({
    queryKey: keys.rules(ministryId, orgId),
    queryFn: () => fetchEventRules(ministryId, orgId),
    enabled: isQueryEnabled,
    staleTime: STALE_SLOW,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false
  });

  // 12. Next Event (NEW)
  const nextEventQuery: UseQueryResult<any> = useQuery({
    queryKey: keys.nextEvent(ministryId, orgId),
    queryFn: () => fetchNextEventCardData(ministryId, orgId),
    enabled: isQueryEnabled,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: STALE_REALTIME,
    gcTime: GC_TIME
  });

  // 13. Availability V2 (ID-Based)
  const availabilityV2Query: UseQueryResult<{ availability: Record<string, string[]>; notes: Record<string, string> }> = useQuery({
    queryKey: keys.availabilityV2(ministryId, orgId),
    queryFn: () => Supabase.fetchMemberAvailabilityV2(ministryId, orgId),
    enabled: isQueryEnabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: GC_TIME,
    refetchOnWindowFocus: false
  });

  return {
    settingsQuery,
    assignmentsQuery,
    membersQuery,
    availabilityQuery,
    notificationsQuery,
    announcementsQuery,
    swapsQuery,
    repertoireQuery,
    conflictsQuery,
    rulesQuery,
    nextEventQuery,
    availabilityV2Query,
    isLoading: isQueryEnabled && (settingsQuery.isLoading || assignmentsQuery.isLoading || membersQuery.isLoading)
  };
}

export function useScheduleMutations(ministryId: string, currentMonth: string, orgId: string) {
  const queryClient = useQueryClient();

  const updateAssignment = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const parts = key.split('|');
      const ruleId = parts[0];
      const date = parts[1];
      const role = parts.slice(2).join('|');
      
      if (value) {
          await saveAssignmentV2(ministryId, orgId, {
              event_rule_id: ruleId,
              event_date: date,
              role,
              member_id: value
          });
      } else {
          await removeAssignmentV2(ministryId, orgId, {
              event_rule_id: ruleId,
              event_date: date,
              role
          });
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', ministryId, currentMonth, orgId] });
    }
  });

  const toggleAttendance = useMutation({
    mutationFn: async (key: string) => {
        await toggleAssignmentConfirmation(ministryId, orgId, key);
        return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', ministryId, currentMonth, orgId] });
    }
  });

  return { updateAssignment, toggleAttendance };
}