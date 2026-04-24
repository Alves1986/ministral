import React, { useMemo } from 'react';
import { AvailabilityScreen } from '../components/AvailabilityScreen';
import { SwapRequestsScreen } from '../components/SwapRequestsScreen';
import { AnnouncementsScreen } from '../components/AnnouncementsScreen';
import { RepertoireScreen } from '../components/RepertoireScreen';
import * as Supabase from '../services/supabase';
import { QueryClient } from '@tanstack/react-query';
import { User, RepertoireItem, SwapRequest, CustomEvent, ScheduleMap, Announcement, AvailabilityMap, AvailabilityNotesMap, TeamMemberProfile } from '../types';

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
  events: { id: string; iso: string; title: string; dateDisplay: string }[];
  addToast: (msg: string, type: 'success'|'error'|'info'|'warning') => void;
  refreshData: () => void;
  
  announcements: Announcement[];

  repertoire: RepertoireItem[];
  isAdmin: boolean | undefined;
  currentTab: string;
  safeEnabledTabs: string[];
}

export function useScreenMemos(props: ScreenMemosProps) {
  const {
    availability, availabilityNotes, setAvailability, publicMembers,
    currentMonth, setCurrentMonth, activeUser, orgId, availabilityWindow,
    ministryId, queryClient, schedule, swapRequests, events, addToast,
    refreshData, announcements, repertoire, isAdmin, currentTab, safeEnabledTabs
  } = props;

  const availabilityScreen = useMemo(() => (
    <AvailabilityScreen 
        availability={availability} 
        availabilityNotes={availabilityNotes} 
        setAvailability={setAvailability} 
        members={publicMembers} 
        currentMonth={currentMonth} 
        onMonthChange={setCurrentMonth} 
        currentUser={activeUser!} 
        onSaveAvailability={async (mid, userId, d, n, t) => { 
            await Supabase.saveMemberAvailabilityV2(orgId!, mid, userId, d, n, t); 
            await queryClient.invalidateQueries({ queryKey: ['availabilityV2', mid, orgId] });
        }} 
        availabilityWindow={availabilityWindow} 
        ministryId={ministryId} 
    />
  ), [availability, availabilityNotes, setAvailability, publicMembers, currentMonth, activeUser, orgId, availabilityWindow, ministryId, queryClient]);

  const swapsScreen = useMemo(() => (
    <SwapRequestsScreen 
        schedule={schedule} 
        currentMonth={currentMonth} 
        currentUser={activeUser!} 
        requests={swapRequests} 
        visibleEvents={events} 
        onCreateRequest={async (role, iso, title) => { 
            try {
                await Supabase.createSwapRequestSQL(ministryId, orgId!, { id: '', ministryId, requesterName: activeUser!.name, requesterId: activeUser!.id || '', role: role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); 
                addToast("Pedido de troca solicitado com sucesso.", "success");
            } catch (e: any) {
                addToast("Erro ao solicitar troca: " + (e.message || "Erro desconhecido"), "error");
                console.error(e);
                throw e;
            }
        }} 
        onAcceptRequest={async (reqId) => { 
            try {
                await Supabase.performSwapSQL(ministryId, orgId!, reqId, activeUser!.name, activeUser!.id!); 
                addToast("Escala assumida com sucesso.", "success");
            } catch (e: any) {
                addToast("Erro ao assumir escala: " + (e.message || "Erro desconhecido"), "error");
                console.error(e);
            }
        }} 
        onCancelRequest={async (reqId) => { 
            try {
                await Supabase.cancelSwapRequestSQL(reqId, orgId!); 
                addToast("Pedido removido com sucesso.", "info"); 
            } catch (e: any) {
                addToast("Erro ao remover pedido: " + (e.message || "Erro desconhecido"), "error");
                console.error(e);
            }
        }} 
    />
  ), [schedule, currentMonth, activeUser, swapRequests, events, ministryId, orgId, addToast, refreshData]);

  const announcementsScreen = useMemo(() => (
    <AnnouncementsScreen 
        announcements={announcements} 
        currentUser={activeUser!} 
        onRefresh={refreshData}
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
  ), [announcements, activeUser, ministryId, orgId, queryClient, refreshData]);

  const repertoireScreen = useMemo(() => (
    <>
      {(currentTab === 'repertoire' && safeEnabledTabs.includes('repertoire')) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { refreshData(); }} currentUser={activeUser!} mode="view" ministryId={ministryId} />}
      {(currentTab === 'repertoire-manager' && isAdmin && safeEnabledTabs.includes('repertoire-manager')) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { refreshData(); }} currentUser={activeUser!} mode="manage" ministryId={ministryId} />}
    </>
  ), [currentTab, safeEnabledTabs, repertoire, activeUser, isAdmin, ministryId, refreshData]);

  return { availabilityScreen, swapsScreen, announcementsScreen, repertoireScreen };
}
