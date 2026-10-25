import React, { useMemo, lazy } from 'react';
import * as Supabase from '../services/supabase';
import { QueryClient } from '@tanstack/react-query';
import { User, RepertoireItem, SwapRequest, CustomEvent, ScheduleMap, Announcement, AvailabilityMap, AvailabilityNotesMap, TeamMemberProfile } from '../types';

const AvailabilityScreen = lazy(() => import('../components/AvailabilityScreen').then(m => ({ default: m.AvailabilityScreen })));
const SwapRequestsScreen = lazy(() => import('../components/SwapRequestsScreen').then(m => ({ default: m.SwapRequestsScreen })));
const AnnouncementsScreen = lazy(() => import('../components/AnnouncementsScreen').then(m => ({ default: m.AnnouncementsScreen })));
const RepertoireScreen = lazy(() => import('../components/RepertoireScreen').then(m => ({ default: m.RepertoireScreen })));


export interface ScreenMemosProps {
  availability: AvailabilityMap;
  availabilityNotes: AvailabilityNotesMap;
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityMap>>;
  publicMembers: TeamMemberProfile[];
  currentMonth: string;
  setCurrentMonth: (month: string) => void;
  activeUser: User;
  orgId: string;
  availabilityWindow: any;
  ministryId: string;
  queryClient: QueryClient;
  
  schedule: ScheduleMap;
  swapRequests: SwapRequest[];
  events: (CustomEvent & { dateDisplay: string })[];
  addToast: (msg: string, type: 'success'|'error'|'info'|'warning') => void;
  refreshData: () => void;
  
  announcements: Announcement[];

  repertoire: RepertoireItem[];
  isAdmin: boolean | undefined;
  currentTab: string;
  safeEnabledTabs: string[];
  integrations: any;

  orgName?: string;
  ministryTitle?: string;
  roles?: string[];
  onSendAnnouncement?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert', expirationDate: string, externalLink?: string) => Promise<void>;
  openCreateAnnouncement?: boolean;
  onCloseCreateAnnouncement?: () => void;
}

export function useScreenMemos(props: ScreenMemosProps) {
  const {
    availability, availabilityNotes, setAvailability, publicMembers,
    currentMonth, setCurrentMonth, activeUser, orgId, availabilityWindow,
    ministryId, queryClient, schedule, swapRequests, events, addToast,
    refreshData, announcements, repertoire, isAdmin, currentTab, safeEnabledTabs, integrations,
    orgName = '', ministryTitle = '', roles = [], onSendAnnouncement,
    openCreateAnnouncement = false, onCloseCreateAnnouncement
  } = props;

  const availabilityScreen = useMemo(() => (
    <AvailabilityScreen 
        key={ministryId}
        availability={availability} 
        availabilityNotes={availabilityNotes} 
        setAvailability={setAvailability}
        members={publicMembers} 
        currentMonth={currentMonth} 
        onMonthChange={setCurrentMonth} 
        currentUser={activeUser!} 
        onSaveAvailability={async (mid, userId, d, n, t) => { 
            // Optimistic update no cache do TanStack Query para sincronia visual imediata
            queryClient.setQueryData(['availabilityV2', mid, orgId!], (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    availability: {
                        ...(old.availability || {}),
                        [userId]: d
                    },
                    notes: {
                        ...(old.notes || {}),
                        ...n
                    }
                };
            });
            await Supabase.saveMemberAvailabilityV2(orgId!, mid, userId, d, n, t); 
            queryClient.invalidateQueries({ queryKey: ['availabilityV2', mid, orgId] });
        }}
        availabilityWindow={availabilityWindow}
        ministryId={ministryId}
        events={events}
    />
  ), [availability, availabilityNotes, setAvailability, publicMembers, currentMonth, activeUser, orgId, availabilityWindow, ministryId, queryClient, events]);

  const swapsScreen = useMemo(() => (
    <SwapRequestsScreen 
        key={ministryId}
        schedule={schedule} 
        currentMonth={currentMonth} 
        currentUser={activeUser!} 
        requests={swapRequests} 
        visibleEvents={events} 
        onCreateRequest={async (role, iso, title) => { 
            try {
                await Supabase.createSwapRequestSQL(ministryId, orgId!, { id: '', ministryId, requesterName: activeUser!.name, requesterId: activeUser!.id || '', role: role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); 
                addToast("Pedido de troca solicitado com sucesso.", "success");
                refreshData();
            } catch (e: any) {
                addToast("Erro ao solicitar troca: " + (e.message || "Erro desconhecido"), "error");
                console.error(e);
                throw e;
            }
        }} 
        onAcceptRequest={async (reqId) => { 
            try {
                // Optimistic update
                queryClient.setQueryData(
                    ['swaps', ministryId, orgId],
                    (old: SwapRequest[] | undefined) => (old || []).filter(r => r.id !== reqId)
                );
                await Supabase.performSwapSQL(ministryId, orgId!, reqId, activeUser!.name, activeUser!.id!); 
                addToast("Escala assumida com sucesso.", "success");
                queryClient.invalidateQueries({ queryKey: ['swaps', ministryId, orgId] });
                queryClient.invalidateQueries({ queryKey: ['schedule', ministryId, orgId] });
                refreshData();
            } catch (e: any) {
                queryClient.invalidateQueries({ queryKey: ['swaps', ministryId, orgId] });
                addToast("Erro ao assumir escala: " + (e.message || "Erro desconhecido"), "error");
                console.error(e);
            }
        }} 
        onCancelRequest={async (reqId) => { 
            try {
                await Supabase.cancelSwapRequestSQL(reqId, orgId!); 
                addToast("Pedido removido com sucesso.", "info"); 
                refreshData();
            } catch (e: any) {
                addToast("Erro ao remover pedido: " + (e.message || "Erro desconhecido"), "error");
                console.error(e);
            }
        }} 
    />
  ), [schedule, currentMonth, activeUser, swapRequests, events, ministryId, orgId, addToast, refreshData]);

  const isMinister = activeUser?.ministry_functions?.some(r => r.toLowerCase().includes('ministro')) || false;
  const canManage = Boolean(isAdmin || isMinister);

  const announcementsScreen = useMemo(() => (
    <AnnouncementsScreen 
        announcements={announcements} 
        currentUser={activeUser!} 
        onRefresh={refreshData}
        canCreate={canManage}
        orgName={orgName}
        ministryName={ministryTitle}
        members={publicMembers}
        roles={roles}
        onSendAnnouncement={onSendAnnouncement}
        initialOpenCreate={openCreateAnnouncement}
        onCloseCreate={onCloseCreateAnnouncement}
        onMarkRead={async (id) => {
            queryClient.setQueryData(['announcements', ministryId, orgId!], (old: any) => {
                if (!old) return old;
                return old.map((a: any) => {
                    if (a.id === id) {
                        const readBy = a.readBy || [];
                        const alreadyRead = readBy.some((r: any) => r.userId === activeUser!.id);
                        if (alreadyRead) return a;
                        return { 
                            ...a, 
                            readBy: [...readBy, { 
                                userId: activeUser!.id, 
                                name: activeUser!.name, 
                                timestamp: new Date().toISOString() 
                            }] 
                        };
                    }
                    return a;
                });
            });
            await Supabase.interactAnnouncementSQL(id, activeUser!.id!, activeUser!.name, 'read', orgId!);
            await queryClient.invalidateQueries({ queryKey: ['announcements'] });
        }} 
        onToggleLike={async (id) => {
            queryClient.setQueryData(['announcements', ministryId, orgId!], (old: any) => {
                if (!old) return old;
                return old.map((a: any) => {
                    if (a.id === id) {
                        const likedBy = a.likedBy || [];
                        const hasLiked = likedBy.some((l: any) => l.userId === activeUser!.id);
                        return { 
                            ...a, 
                            likedBy: hasLiked 
                                ? likedBy.filter((l: any) => l.userId !== activeUser!.id) 
                                : [...likedBy, { 
                                    userId: activeUser!.id, 
                                    name: activeUser!.name, 
                                    timestamp: new Date().toISOString() 
                                }] 
                        };
                    }
                    return a;
                });
            });
            await Supabase.interactAnnouncementSQL(id, activeUser!.id!, activeUser!.name, 'like', orgId!);
            await queryClient.invalidateQueries({ queryKey: ['announcements'] });
        }} 
        onTogglePin={async (id, isPinned) => {
            try {
                await Supabase.toggleAnnouncementPinSQL(id, orgId!, !isPinned);
                await queryClient.invalidateQueries({ queryKey: ['announcements'] });
                addToast(!isPinned ? "Aviso fixado no topo." : "Aviso desafixado.", "success");
            } catch (error: any) {
                console.error("Failed to pin:", error);
                if (error.message === "MISSING_COLUMN") {
                    addToast("Para usar o alfinete, execute no Supabase SQL Editor: ALTER TABLE public.announcements ADD COLUMN is_pinned BOOLEAN DEFAULT false;", "error");
                } else {
                    addToast("Erro ao fixar aviso.", "error");
                }
            }
        }}
    />
  ), [announcements, activeUser, ministryId, orgId, queryClient, refreshData, canManage, orgName, ministryTitle, publicMembers, roles, onSendAnnouncement, openCreateAnnouncement, onCloseCreateAnnouncement, addToast]);

  const repertoireScreen = useMemo(() => {
    const isRepertoireTab = currentTab === 'repertoire' || currentTab === 'repertoire-manager';
    const isEnabled = safeEnabledTabs.includes('repertoire') || safeEnabledTabs.includes('repertoire-manager');

    if (!isRepertoireTab || !isEnabled) return null;

    return (
      <RepertoireScreen 
        key={ministryId}
        repertoire={repertoire} 
        setRepertoire={async () => { refreshData(); }} 
        currentUser={activeUser!} 
        mode={canManage ? 'manage' : 'view'} 
        ministryId={ministryId} 
        integrations={integrations} 
        events={events}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
      />
    );
  }, [currentTab, safeEnabledTabs, repertoire, activeUser, canManage, ministryId, refreshData, integrations, events, currentMonth, setCurrentMonth]);

  return { availabilityScreen, swapsScreen, announcementsScreen, repertoireScreen };
}
