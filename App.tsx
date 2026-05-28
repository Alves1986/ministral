import React, { useState, useEffect, Suspense, useMemo, lazy } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from './store/appStore';
import { useSession, SessionProvider } from './context/SessionContext';
import { useToast, ToastProvider } from './components/Toast';
import * as Supabase from './services/supabaseService';
import { DEFAULT_TABS, ALL_TABS, User } from './types';
import { useMinistryData } from './hooks/useMinistryData';
import { useScreenMemos } from './hooks/useScreenMemos';
import { useOnlinePresence } from './hooks/useOnlinePresence';
import { getLocalDateISOString, getMonthName, adjustMonth } from './utils/dateUtils';
import { generateIndividualPDF, generateFullSchedulePDF } from './utils/pdfGenerator';
import { subscribeUserToPush } from './utils/pushUtils';
import { getSupabase } from './services/supabase/client';
import { handleLoginCallback } from './services/spotifyService';

import { 
  LayoutDashboard, CalendarCheck, RefreshCcw, Music, 
  Megaphone, Settings, FileBarChart, CalendarDays,
  Users, Edit, Send, ListMusic, ArrowLeft, ArrowRight,
  Calendar as CalendarIcon, Trophy, Loader2, MousePointerClick, Briefcase, History as HistoryIcon, FileText, ChevronRight,
  AlertTriangle, Database, RefreshCw, ShieldCheck, Crown, Sparkles
} from 'lucide-react';

import { LoadingScreen } from './components/LoadingScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { LoginScreen } from './components/LoginScreen';
import { InviteScreen } from './components/InviteScreen'; 
import { BillingLockScreen, OrganizationInactiveScreen } from './components/LockScreens';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardLayout } from './components/DashboardLayout';
import { WeatherWidget } from './components/WeatherWidget';
import { NextEventCard } from './components/NextEventCard';
import { BirthdayCard } from './components/BirthdayCard';
import { CalendarGrid } from './components/CalendarGrid';
import { ToolsMenu } from './components/ToolsMenu';

import { InstallModal } from './components/InstallModal';
import { JoinMinistryModal } from './components/JoinMinistryModal';
import { InstallBanner } from './components/InstallBanner';

const ScheduleEditorV2 = lazy(() => import('./components/ScheduleEditorV2').then(m => ({ default: m.ScheduleEditorV2 })));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const AvailabilityScreen = lazy(() => import('./components/AvailabilityScreen').then(m => ({ default: m.AvailabilityScreen })));
const SwapRequestsScreen = lazy(() => import('./components/SwapRequestsScreen').then(m => ({ default: m.SwapRequestsScreen })));
const RankingScreen = lazy(() => import('./components/RankingScreen').then(m => ({ default: m.RankingScreen })));
const RepertoireScreen = lazy(() => import('./components/RepertoireScreen').then(m => ({ default: m.RepertoireScreen })));
const AnnouncementsScreen = lazy(() => import('./components/AnnouncementsScreen').then(m => ({ default: m.AnnouncementsScreen })));
const ProfileScreen = lazy(() => import('./components/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const SettingsScreen = lazy(() => import('./components/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const MembersScreen = lazy(() => import('./components/MembersScreen').then(m => ({ default: m.MembersScreen })));
const EventsScreen = lazy(() => import('./components/EventsScreen').then(m => ({ default: m.EventsScreen })));
const ScheduleRulesScreen = lazy(() => import('./components/ScheduleRulesScreen').then(m => ({ default: m.ScheduleRulesScreen })));
const AvailabilityReportScreen = lazy(() => import('./components/AvailabilityReportScreen').then(m => ({ default: m.AvailabilityReportScreen })));
const MonthlyReportScreen = lazy(() => import('./components/MonthlyReportScreen').then(m => ({ default: m.MonthlyReportScreen })));
const AdvancedAIScreen = lazy(() => import('./components/AdvancedAIScreen').then(m => ({ default: m.AdvancedAIScreen })));
const HistoryScreen = lazy(() => import('./components/HistoryScreen').then(m => ({ default: m.HistoryScreen })));
const AlertsManager = lazy(() => import('./components/AlertsManager').then(m => ({ default: m.AlertsManager })));
const EventsModal = lazy(() => import('./components/ManagementModals').then(m => ({ default: m.EventsModal })));
const AvailabilityModal = lazy(() => import('./components/ManagementModals').then(m => ({ default: m.AvailabilityModal })));
const RolesModal = lazy(() => import('./components/ManagementModals').then(m => ({ default: m.RolesModal })));
const EventDetailsModal = lazy(() => import('./components/EventDetailsModal').then(m => ({ default: m.EventDetailsModal })));
const StatsModal = lazy(() => import('./components/StatsModal').then(m => ({ default: m.StatsModal })));
const ConfirmationModal = lazy(() => import('./components/ConfirmationModal').then(m => ({ default: m.ConfirmationModal })));
const PlanScreen = lazy(() => import('./components/PlanScreen').then(m => ({ default: m.PlanScreen })));
const RegisterOrganizationScreen = lazy(() => import('./components/RegisterOrganizationScreen').then(m => ({ default: m.RegisterOrganizationScreen })));
const PaymentSuccessScreen = lazy(() => import('./components/PaymentSuccessScreen').then(m => ({ default: m.PaymentSuccessScreen })));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[50vh]">
    <Loader2 className="animate-spin text-ministral-500" size={32} />
  </div>
);

const InnerApp = () => {
  const { user: sessionUser, status, error: sessionError, organization, refreshSession } = useSession();
  const { 
      setCurrentUser, 
      setMinistryId, 
      setAvailableMinistries, 
      availableMinistries, 
      ministryId: storeMinistryId, 
      themeMode, 
      setAppReady,
      isAppReady,
      currentUser
  } = useAppStore();
  const { addToast, confirmAction } = useToast();
  const queryClient = useQueryClient();
  
  const [currentMonth, setCurrentMonth] = useState(() => getLocalDateISOString().slice(0, 7));

  const [showSetup, setShowSetup] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('setup') === 'true';
  });

  const [inviteToken, setInviteToken] = useState<string | null>(() => {
      // Ler o token IMEDIATAMENTE na inicializacao do state (antes do primeiro render)
      const params = new URLSearchParams(window.location.search);
      return params.get('invite') || null;
  });

  const [isRegistering] = useState<boolean>(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return params.has('register');
      }
      return false;
  });

  // O token deve ser mantido na URL para permitir recarregamento da página
  // A limpeza só deve ocorrer após validação/uso bem-sucedido no InviteScreen

  useEffect(() => {
    // Processa redirecionamentos do Spotify em qualquer aba logada ou deslogada
    // Se estourar a URL e tirar o Hash, ele armazena antes que seja limpo.
    const token = handleLoginCallback();
    if (token) {
        // Redireciona para a aba de repertório se for um callback de login
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'repertoire');
        window.history.replaceState({}, '', url.toString());
        setCurrentTab('repertoire');
    }
  }, []);

  const hasInitialSync = React.useRef(false);

  useEffect(() => {
      if (status === 'ready' && sessionUser) {
          // 1. Sincroniza usuário
          setCurrentUser(sessionUser);
          
          // 2. Sincronia de ID (apenas no carregamento inicial ou se o store estiver vazio)
          if (!hasInitialSync.current || !storeMinistryId) {
              if (sessionUser.ministryId && sessionUser.ministryId !== storeMinistryId) {
                  setMinistryId(sessionUser.ministryId);
              }
              hasInitialSync.current = true;
          }

          // Timeout de segurança: desbloqueia o app em no máximo 5s
          // mesmo que o fetch falhe silenciosamente ou não retorne.
          const safetyTimer = setTimeout(() => setAppReady(true), 5000);

          if (sessionUser.organizationId) {
              Supabase.fetchOrganizationMinistries(sessionUser.organizationId)
                  .then(ministries => {
                      setAvailableMinistries(ministries);
                      setAppReady(true);
                  })
                  .catch(err => {
                      console.warn("Failed to load menus (non-critical)", err);
                      setAppReady(true);
                  })
                  .finally(() => clearTimeout(safetyTimer));
          } else {
              clearTimeout(safetyTimer);
              setAppReady(true);
          }
      }
  }, [status, sessionUser]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
  }, [themeMode]);

  const [currentTab, setCurrentTab] = useState(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return params.get('tab') || 'dashboard';
      }
      return 'dashboard';
  });

  useEffect(() => {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== currentTab) {
          url.searchParams.set('tab', currentTab);
          try { window.history.replaceState({}, '', url.toString()); } catch (e) {}
      }
  }, [currentTab]);

  const activeUser = currentUser || sessionUser;
  const ministryId = storeMinistryId || activeUser?.ministryId || '';
  const isAdmin = activeUser?.access_role === 'admin' || activeUser?.isOrgAdmin || activeUser?.isSuperAdmin;
  const orgId = activeUser?.organizationId; 

  const ministryConfig = useMemo(() => {
      return availableMinistries.find(m => m.id === ministryId) || { 
          id: ministryId, 
          code: ministryId,
          label: '', 
          enabledTabs: DEFAULT_TABS,
      };
  }, [availableMinistries, ministryId]);

  const { 
    events, schedule, attendance,
    membersMap, publicMembers, availability, availabilityNotes, 
    availabilityByName, notesByName, // NEW Legacy Props
    notifications, announcements, 
    repertoire, swapRequests, globalConflicts, roles, rawRoles, expandedRoles,
    ministryTitle, availabilityWindow, integrations, eventRules, nextEvent, 
    refreshData, isLoading: loadingData,
    setAvailability, setNotifications 
  } = useMinistryData(ministryId, currentMonth, activeUser);

  const onlineUsers = useOnlinePresence(activeUser?.id, activeUser?.name);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [eventDetailsModal, setEventDetailsModal] = useState<{ isOpen: boolean; event: any | null }>({ isOpen: false, event: null });
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<any>(null);
  const [isEventsModalOpen, setEventsModalOpen] = useState(false);
  const [isAvailModalOpen, setAvailModalOpen] = useState(false);
  const [isRolesModalOpen, setRolesModalOpen] = useState(false);

  useEffect(() => {
      const handlePwaReady = () => setShowInstallBanner(true);
      window.addEventListener('pwa-ready', handlePwaReady);
      return () => window.removeEventListener('pwa-ready', handlePwaReady);
  }, []);

  // --- CACHE INVALIDATION BROADCAST ---
  useEffect(() => {
    const sb = Supabase.getSupabase();
    if (!sb || !orgId) return;

    const channel = sb.channel('cache-invalidation')
      .on('broadcast', { event: 'invalidate' }, (payload: any) => {
        console.log("[App] Cache invalidation received:", payload);
        if (payload.orgId === orgId) {
          // Se for para o ministério atual ou global da organização
          if (!payload.ministryId || payload.ministryId === ministryId) {
            refreshData();
          }
        }
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [orgId, ministryId, refreshData]);

  useEffect(() => {
      const isKnownTab = ALL_TABS.includes(currentTab) || currentTab === 'profile';
      
      if (!isKnownTab) {
          setCurrentTab('dashboard');
      }
  }, [currentTab, ministryConfig]);

  // --- IMPERCEPTIBLE UPDATE ON TAB CHANGE ---
  // Removido para otimizar performance conforme solicitado pelo usuário.
  // O sistema agora conta com o botão de refresh manual e invalidação via Realtime.

  const handleLogout = () => {
   if (status === 'ready') {
       confirmAction('Sair', 'Deseja realmente sair do sistema?', async () => {
           try {
               await Supabase.logout();
           } finally {
               setCurrentUser(null);
           }
       });
   } else {
       Supabase.logout().finally(() => {
           setCurrentUser(null);
       });
   }
  };

  const handleEnableNotifications = async () => {
      const sub = await subscribeUserToPush();
      if (sub) {
          addToast("Notificações ativadas!", "success");
      } else {
          addToast("Não foi possível ativar notificações. Verifique as permissões do navegador.", "error");
      }
  };

  const RAW_MAIN_NAV = useMemo(() => [
    { id: 'dashboard', label: 'Início', icon: <LayoutDashboard size={20}/> },
    { id: 'announcements', label: 'Avisos', icon: <Megaphone size={20}/> },
    { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={20}/> },
    { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck size={20}/> },
    { id: 'swaps', label: 'Trocas', icon: <RefreshCcw size={20}/> },
    { id: 'repertoire', label: 'Repertório', icon: <Music size={20}/> },
    { id: 'ranking', label: 'Destaques', icon: <Trophy size={20}/> },
    { id: 'history', label: 'Histórico', icon: <HistoryIcon size={20}/> },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20}/> },
  ], []);

  const RAW_MANAGEMENT_NAV = useMemo(() => [
    { id: 'schedule-editor', label: 'Editor de Escala', icon: <Edit size={20}/> },
    { id: 'monthly-report', label: 'Relatório Mensal', icon: <FileText size={20}/> },
    { id: 'repertoire-manager', label: 'Ger. Repertório', icon: <ListMusic size={20}/> },
    { id: 'report', label: 'Relat. Disp.', icon: <FileBarChart size={20}/> },
    { id: 'event-rules', label: 'Regras de Agenda', icon: <CalendarDays size={20}/> },
    { id: 'schedule-rules', label: 'Regras de Escala', icon: <ShieldCheck size={20}/> },
    { id: 'plan', label: 'Plano e Assinatura', icon: <Crown size={20}/> },
    { id: 'send-announcements', label: 'Enviar Avisos', icon: <Send size={20}/> },
    { id: 'members', label: 'Membros', icon: <Users size={20}/> },
    { id: 'advanced-ai', label: 'IA Avançada', icon: <Sparkles size={20}/> },
  ], []);

  const RAW_QUICK_ACTIONS = useMemo(() => [
    { id: 'calendar', label: 'Ver Escala', icon: <CalendarIcon size={24} />, color: 'bg-secondary', hover: 'hover:bg-secondaryHover' },
    { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck size={24} />, color: 'bg-secondary', hover: 'hover:bg-secondaryHover' },
    { id: 'history', label: 'Meu Histórico', icon: <HistoryIcon size={24} />, color: 'bg-zinc-800', hover: 'hover:bg-zinc-900' },
    { id: 'swaps', label: 'Trocas', icon: <RefreshCcw size={24} />, color: 'bg-ministral-gold', hover: 'hover:bg-ministral-gold/80' },
    { id: 'repertoire', label: 'Repertório', icon: <ListMusic size={24} />, color: 'bg-secondary', hover: 'hover:bg-secondaryHover' },
  ], []);

  const safeEnabledTabs = useMemo(() => {
    const tabs = ministryConfig.enabledTabs || DEFAULT_TABS;
    return tabs.includes('history') ? tabs : [...tabs, 'history'];
  }, [ministryConfig.enabledTabs]);

  const isPro = activeUser?.isPro ?? false;
  
  const MAIN_NAV = useMemo(() => 
    RAW_MAIN_NAV.filter(item => safeEnabledTabs.includes(item.id)),
    [RAW_MAIN_NAV, safeEnabledTabs]
  );

  const MANAGEMENT_NAV = useMemo(() => 
    RAW_MANAGEMENT_NAV
    .filter(item => safeEnabledTabs.includes(item.id) || item.id === 'plan' || item.id === 'advanced-ai')
    .filter(item => {
      if (!isPro && ['schedule-rules','monthly-report','report','advanced-ai'].includes(item.id))
        return false;
      return true;
    }),
    [RAW_MANAGEMENT_NAV, safeEnabledTabs, isPro]
  );

  const QUICK_ACTIONS = useMemo(() => 
    RAW_QUICK_ACTIONS.filter(item => {
        const isEnabled = safeEnabledTabs.includes(item.id);
        if (!isEnabled) return false;
        
        if (integrations.quickAccessItems === null || integrations.quickAccessItems === undefined) {
          return true;
        }
        
        return integrations.quickAccessItems.includes(item.id);
    }),
    [RAW_QUICK_ACTIONS, safeEnabledTabs, integrations.quickAccessItems]
  );

  const isTabValid = safeEnabledTabs.includes(currentTab) || ['profile', 'super-admin', 'dashboard', 'plan', 'history', 'advanced-ai'].includes(currentTab);

  const dashboardScreen = useMemo(() => (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
            <div className="animate-slide-up flex justify-between items-center w-full">
                <div>
                    <h1 className="text-2xl md:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight flex items-center gap-3">
                        Olá, <span className="text-secondary dark:text-white">{activeUser?.name.split(' ')[0]}</span>
                        <button 
                            onClick={async () => {
                                if (isDashboardRefreshing) return;
                                setIsDashboardRefreshing(true);
                                try {
                                    refreshData();
                                    await new Promise(r => setTimeout(r, 1200));
                                } finally {
                                    setIsDashboardRefreshing(false);
                                }
                            }}
                            disabled={isDashboardRefreshing}
                            className={`p-2 rounded-full transition-all duration-300 ${
                                isDashboardRefreshing 
                                    ? 'text-secondary bg-secondary/10 cursor-not-allowed' 
                                    : 'text-zinc-400 hover:text-secondary hover:bg-secondary/10'
                            }`}
                            title="Atualizar dados do sistema"
                        >
                            <RefreshCw size={20} className={isDashboardRefreshing ? 'animate-spin' : ''} />
                        </button>
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-base mt-1 font-medium">Excelência na escala. Propósito no servir.</p>
                </div>
                <div className="hidden md:block animate-fade-in" style={{ animationDelay: '0.1s' }}><WeatherWidget /></div>
            </div>

        <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <NextEventCard 
                event={nextEvent} 
                schedule={schedule} 
                attendance={attendance} 
                roles={roles} 
                members={publicMembers} 
                onConfirm={async (key) => {
                    if (nextEvent && nextEvent.event) {
                        const role = key.split('|').slice(2).join('|') || '';
                        const memberName = activeUser?.name || '';
                        setConfirmModalData({ 
                            key, 
                            memberName, 
                            eventName: nextEvent.event.title, 
                            date: nextEvent.event.date.split('-').reverse().slice(0, 2).join('/'), 
                            role 
                        }); 
                    }
                }} 
                ministryId={ministryId} 
                ministryName={ministryTitle}
                currentUser={activeUser!} 
            />
        </div>

        <div className="hidden lg:block space-y-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <MousePointerClick size={14}/> Acesso Rápido
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {RAW_QUICK_ACTIONS.filter(action => safeEnabledTabs.includes(action.id) || action.id === 'history').map((action) => (
                    <button
                        key={action.id}
                        onClick={() => setCurrentTab(action.id)}
                        className="group relative flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-black/50 hover:-translate-y-1 active:scale-95 overflow-hidden"
                    >
                        <div className={`absolute top-0 left-0 w-full h-1 ${action.color} opacity-80`}></div>
                        <div className={`mb-3 p-3 rounded-xl ${action.color} text-white shadow-lg transition-transform group-hover:scale-110`}>
                            {action.icon}
                        </div>
                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">{action.label}</span>
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight size={14} className="text-zinc-400" />
                        </div>
                    </button>
                ))}
            </div>
        </div>
        
        <div className="animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <BirthdayCard members={publicMembers} currentMonthIso={currentMonth} />
        </div>
    </div>
  ), [activeUser, isDashboardRefreshing, refreshData, nextEvent, schedule, attendance, roles, publicMembers, ministryId, RAW_QUICK_ACTIONS, safeEnabledTabs, setCurrentTab, currentMonth]);

  const calendarScreen = useMemo(() => (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2"><CalendarIcon className="text-ministral-500"/> Calendário</h2>
            <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 min-w-[100px] text-center">{getMonthName(currentMonth)}</span>
                <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
            </div>
        </div>
        <CalendarGrid currentMonth={currentMonth} events={events} schedule={schedule} roles={expandedRoles} onEventClick={(event) => setEventDetailsModal({ isOpen: true, event })} />
    </div>
  ), [currentMonth, events, schedule, expandedRoles, setEventDetailsModal]);

  const { availabilityScreen, swapsScreen, announcementsScreen, repertoireScreen } = useScreenMemos({
    availability, availabilityNotes, setAvailability, publicMembers,
    currentMonth, setCurrentMonth, activeUser: activeUser!, orgId: orgId!, availabilityWindow,
    ministryId, queryClient, schedule, swapRequests, events, addToast,
    refreshData, announcements, repertoire, isAdmin, currentTab, safeEnabledTabs, integrations
  });



  const scheduleEditorScreen = useMemo(() => (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 border-b border-zinc-200 dark:border-zinc-700 pb-6">
            <div className="w-full xl:w-auto">
                <h2 className="text-3xl font-bold text-zinc-800 dark:text-white flex items-center gap-3">
                    <Edit className="text-ministral-500" size={32} /> Editor de Escala
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">Gerencie a escala oficial de {getMonthName(currentMonth)}.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:overflow-visible pb-1 sm:pb-0">
                    <button onClick={() => setRolesModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm font-bold whitespace-nowrap border border-zinc-200 dark:border-zinc-700">
                        <Briefcase size={16}/> <span>Funções</span>
                    </button>
                    <ToolsMenu 
                        onExportIndividual={(member) => generateIndividualPDF(ministryTitle, currentMonth, member, events.map(e => ({...e, dateDisplay: e.iso.split('T')[0].split('-').reverse().join('/')})), schedule, organization?.logo_url)} 
                        onExportFull={() => generateFullSchedulePDF(ministryTitle, currentMonth, events.map(e => ({...e, dateDisplay: e.iso.split('T')[0].split('-').reverse().join('/')})), roles, schedule, organization?.logo_url)} 
                        onClearMonth={() => confirmAction("Limpar?", "Limpar escala?", async () => {
                            try {
                                await Supabase.clearScheduleForMonth(ministryId, orgId!, currentMonth);
                                queryClient.setQueryData(['schedule', ministryId, orgId!, currentMonth], {});
                                addToast("Escala limpa com sucesso", "success");
                                refreshData();
                                window.dispatchEvent(new Event('refresh-assignments'));
                            } catch (e) {
                                addToast("Erro ao limpar escala", "error");
                            }
                        })}
                        allMembers={publicMembers.map(m => m.name)} 
                    />
                </div>
            </div>
        </div>
        <ScheduleEditorV2 
            ministryId={ministryId} 
            orgId={orgId!} 
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            currentTab={currentTab}
            isAdmin={isAdmin}
            isPro={activeUser?.isPro ?? false}
            roles={expandedRoles}
        />
    </div>
  ), [currentMonth, ministryTitle, events, schedule, roles, organization, ministryId, orgId, publicMembers, currentTab, isAdmin, activeUser, expandedRoles, refreshData, queryClient, confirmAction, addToast, setRolesModalOpen]);

  const rankingScreen = useMemo(() => (
    <RankingScreen ministryId={ministryId} currentUser={activeUser!} />
  ), [ministryId, activeUser]);

  const settingsScreen = useMemo(() => (
    <SettingsScreen 
        initialTitle={ministryTitle} 
        ministryId={ministryId} 
        themeMode={themeMode} 
        onSetThemeMode={(m) => useAppStore.getState().setThemeMode(m)} 
        onSaveTitle={async (newTitle) => { 
            await Supabase.saveMinistrySettings(ministryId, orgId!, newTitle); 
            const updatedMinistries = availableMinistries.map(m => m.id === ministryId ? { ...m, label: newTitle } : m);
            setAvailableMinistries(updatedMinistries);
            addToast("Nome atualizado com sucesso", "success");
            refreshData(); 
        }} 
        onSaveAvailabilityWindow={async (start, end) => { await Supabase.saveMinistrySettings(ministryId, orgId!, undefined, undefined, start, end); refreshData(); }} 
        availabilityWindow={availabilityWindow} 
        isAdmin={isAdmin} 
        orgId={orgId!} 
        onEnableNotifications={handleEnableNotifications} 
        onSaveEnabledTabs={async (newTabs) => {
            await Supabase.saveEnabledTabs(ministryId, orgId!, newTabs);
            const updatedMinistries = availableMinistries.map(m =>
                m.id === ministryId ? { ...m, enabledTabs: newTabs } : m
            );
            setAvailableMinistries(updatedMinistries);
            addToast("Abas atualizadas com sucesso", "success");
            refreshData();
        }} 
        onSaveIntegrations={async (sid, ssec, ykey, qitems) => {
            try {
                await Supabase.saveMinistrySettings(ministryId, orgId!, undefined, undefined, undefined, undefined, sid, ssec, ykey, undefined, undefined, qitems);
                addToast("Configurações atualizadas com sucesso", "success");
                refreshData();
            } catch(e) {
                addToast("Erro ao salvar configurações", "error");
            }
        }} 
        onSaveOrgLogo={async (file: File | null) => {
            if (!orgId) return null;
            const url = await Supabase.uploadOrganizationLogo(orgId, file);
            if (url !== null) {
                await refreshSession();
                refreshData();
            }
            return url;
        }} 
        ministryConfig={{ ...ministryConfig, ...integrations }} 
        organization={organization} 
        ministries={availableMinistries}
    />
  ), [ministryTitle, ministryId, themeMode, availableMinistries, availabilityWindow, isAdmin, orgId, handleEnableNotifications, ministryConfig, integrations, organization, refreshData, refreshSession, setAvailableMinistries, addToast]);

  const membersScreen = useMemo(() => (
     <MembersScreen 
        members={publicMembers} 
        onlineUsers={onlineUsers} 
        currentUser={{ ...activeUser, ministryId } as User} 
        availableRoles={roles} 
        onToggleAdmin={async (email, currentStatus, name) => { await Supabase.toggleAdminSQL(email, !currentStatus, ministryId, orgId!); refreshData(); }} 
        onRemoveMember={async (id, name) => { 
            queryClient.setQueryData(['members', ministryId, orgId!], (old: any) => old ? { ...old, publicList: old.publicList.filter((m: any) => m.id !== id) } : old); 
            await Supabase.deleteMember(ministryId, orgId!, id, name); 
            refreshData(); 
        }} 
        onUpdateMember={async (id, data) => { 
            queryClient.setQueryData(['members', ministryId, orgId!], (old: any) => old ? { ...old, publicList: old.publicList.map((m: any) => m.id === id ? { ...m, ...data } : m) } : old); 
            await Supabase.updateMemberData(id, orgId!, data); 
            refreshData(); 
        }} 
        isPro={activeUser?.isPro ?? false} 
        isEnterprise={activeUser?.isEnterprise ?? false} 
        notifications={notifications}
        onApproveJoin={async (notifId, userId, roles) => {
            await Supabase.approveJoinRequest(notifId, userId, ministryId, orgId!, roles);
            addToast("Membro aprovado com sucesso!", "success");
            refreshData();
        }}
        onRejectJoin={async (notifId, userId) => {
            await Supabase.rejectJoinRequest(notifId, orgId!, ministryId, userId);
            addToast("Solicitação recusada.", "info");
            refreshData();
        }}
    />
  ), [publicMembers, onlineUsers, activeUser, ministryId, roles, orgId, queryClient, refreshData, notifications, addToast]);

  // --- Conditional Rendering ---

  if (showSetup && status !== 'ready') {
    return <OnboardingScreen />;
  }

  if (inviteToken) {
      return (
          <InviteScreen 
              token={inviteToken} 
              onClear={() => {
                  setInviteToken(null);
                  const url = new URL(window.location.href);
                  url.searchParams.delete('invite');
                  window.history.replaceState({}, '', url.toString());
              }}
          />
      );
  }

  if (status === 'authenticating' || status === 'contextualizing' || status === 'idle') {
      return <LoadingScreen />;
  }

  const isPaymentSuccess = new URLSearchParams(window.location.search).get('payment') === 'success';

  if (isPaymentSuccess && organization?.id) {
      return (
          <Suspense fallback={<LoadingScreen />}>
              <PaymentSuccessScreen orgId={organization.id} onRefreshOrg={async () => { await refreshSession(); refreshData(); }} />
          </Suspense>
      );
  }

  if (status === 'locked_inactive') {
      return <OrganizationInactiveScreen onLogout={handleLogout} />;
  }

  if (status === 'locked_billing') {
      return (
          <DashboardLayout
              onLogout={handleLogout}
              title="Assinatura Pendente"
              currentTab="plan"
              onTabChange={() => {}}
              mainNavItems={[]}
              managementNavItems={[{ id: 'plan', label: 'Plano e Assinatura', icon: <Crown size={20}/> }]}
              notifications={[]}
              onNotificationsUpdate={() => {}}
              onInstall={() => {}}
              isStandalone={false}
              onSwitchMinistry={() => {}}
              onOpenJoinMinistry={() => {}}
              activeMinistryId=""
          >
              <Suspense fallback={<LoadingFallback />}>
                  <PlanScreen 
                      organization={organization} 
                      isAdmin={isAdmin ?? false} 
                      onRefreshOrg={async () => { await refreshSession(); refreshData(); }} 
                  />
              </Suspense>
          </DashboardLayout>
      );
  }

  if (status === 'unauthenticated') {
      if (isRegistering) {
          return <RegisterOrganizationScreen />;
      }
      return <LoginScreen />;
  }

  if (status === 'error') {
      if (sessionError?.message === 'ORGANIZATION_ID_MISSING') {
          return <OnboardingScreen />;
      }
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 text-center animate-fade-in">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 shadow-xl border border-red-200 dark:border-red-900/50">
                  <AlertTriangle className="text-red-500 dark:text-red-400" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-2">Erro de Sessão</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-md leading-relaxed text-sm">
                  {sessionError?.message || "Não foi possível estabelecer a conexão."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                  <button 
                      onClick={() => window.location.reload()} 
                      className="flex-1 py-3.5 px-6 bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                      <RefreshCw size={18}/> Tentar Novamente
                  </button>
                  <button 
                      onClick={() => Supabase.logout()} 
                      className="flex-1 py-3.5 px-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-xl font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                      <Database size={18}/> Sair
                  </button>
              </div>
          </div>
      );
  }

  if (!activeUser || !isAppReady) {
      return <LoadingScreen />;
  }

  return (
    <>
      {isRefreshing && (
        <div className="fixed inset-0 z-[200] bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-ministral-500" size={48} />
                <p className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white animate-pulse">Atualizando ambiente...</p>
            </div>
        </div>
      )}
      
      <DashboardLayout
          onLogout={handleLogout}
          title={ministryTitle || 'Carregando...'}
          currentTab={isTabValid ? currentTab : 'dashboard'}
          onTabChange={async (tab) => {
              setCurrentTab(tab);
          }}
          mainNavItems={MAIN_NAV}
          managementNavItems={isAdmin ? MANAGEMENT_NAV : []}
          notifications={notifications}
          onNotificationsUpdate={setNotifications}
          onInstall={() => {
              const prompt = (window as any).deferredPrompt;
              if(prompt) prompt.prompt(); else setShowInstallModal(true);
          }}
          isStandalone={window.matchMedia('(display-mode: standalone)').matches}
          onSwitchMinistry={async (id) => {
              if (id === ministryId) return;
              setIsRefreshing(true);
              
              // Local variables to ensure narrowing for closure
              const uId = activeUser?.id;
              const oId = activeUser?.organizationId;

              if (!uId || !oId) {
                  addToast("Erro: Dados do usuário não encontrados", "error");
                  setIsRefreshing(false);
                  return;
              }
              
              try {
                  // 1. Cancela apenas as queries do ministério ATUAL para evitar
                  // impacto em queries de outros contextos
                  queryClient.cancelQueries({
                      predicate: (query) => {
                          const key = query.queryKey;
                          return Array.isArray(key) && key.includes(ministryId);
                      }
                  });

                  // Prefetch silencioso das queries mais pesadas do novo ministério
                  // (não bloqueia — roda em paralelo com as outras operações)
                  const orgIdLocal = activeUser?.organizationId || '';
                  queryClient.prefetchQuery({
                    queryKey: ['settings', id, orgIdLocal],
                    queryFn: () => Supabase.fetchMinistrySettings(id, orgIdLocal),
                    staleTime: 10 * 60 * 1000
                  });
                  queryClient.prefetchQuery({
                    queryKey: ['members', id, orgIdLocal],
                    queryFn: () => Supabase.fetchMinistryMembers(id, orgIdLocal),
                    staleTime: 5 * 60 * 1000
                  });

                  // 2. Busca permissões para o NOVO ministério ANTES da troca
                  // Isso garante que o store tenha os dados corretos para o render imediato
                  const [access, profileCheck] = await Promise.all([
                      Supabase.fetchUserMinistryAccess(uId, id, oId),
                      Supabase.getSupabase()!.from('profiles').select('allowed_ministries').eq('id', uId).single()
                  ]);
                  
                  // 3. Atualiza no servidor em segundo plano ou aguarda brevemente
                  await Supabase.updateProfileMinistry(uId, id, oId);
                  
                  // 4. Salva o ID antigo para limpeza seletiva e remove queries do ministério anterior
                  const oldMinistryId = ministryId;
                  queryClient.removeQueries({
                      predicate: (query) => query.queryKey[1] === oldMinistryId
                  });

                  // 5. Atualiza a sessão ANTES da troca de estado para garantir consistência
                  await refreshSession();

                  // 6. Atualiza store LOCALMENTE de forma atômica
                  // Usamos os dados que acabamos de buscar para evitar flickering
                  setMinistryId(id);
                  setCurrentUser({ 
                      ...activeUser!, 
                      ministryId: id, 
                      ministry_functions: access.functions,
                      allowedMinistries: profileCheck.data?.allowed_ministries || activeUser!.allowedMinistries, 
                      access_role: activeUser!.isOrgAdmin ? 'admin' : (access.role === 'admin' ? 'admin' : 'member')
                  });

                  const label = availableMinistries.find(m => m.id === id)?.label || 'Ministério';
                  addToast(`Alternado para ${label}`, 'info');
                  
                  // Validação de aba para o NOVO ministério (atualizado para usar o ID passado)
                  const newConfig = availableMinistries.find(m => m.id === id);
                  const newTabs = newConfig?.enabledTabs || DEFAULT_TABS;
                  const isTabStillValid = newTabs.includes(currentTab) || ['profile', 'super-admin', 'dashboard', 'plan', 'history', 'advanced-ai'].includes(currentTab);

                  if (!isTabStillValid) {
                      setCurrentTab('dashboard');
                  }
              } catch (err) {
                  console.error("[onSwitchMinistry] Erro ao trocar:", err);
                  addToast("Erro ao trocar de ministério", "error");
              } finally {
                  setIsRefreshing(false);
              }
          }}
          onOpenJoinMinistry={() => setShowJoinModal(true)}
          onRefreshData={refreshData}
          activeMinistryId={ministryId}
    >
        <Suspense fallback={<LoadingFallback />}>
            <div className="h-full">
                {(currentTab === 'dashboard' || !isTabValid) && dashboardScreen}

                {currentTab === 'calendar' && safeEnabledTabs.includes('calendar') && calendarScreen}

                {currentTab === 'schedule-editor' && isAdmin && safeEnabledTabs.includes('schedule-editor') && status === 'ready' && ministryId.length === 36 && scheduleEditorScreen}

            {currentTab === 'super-admin' && activeUser?.isSuperAdmin && (
                <SuperAdminDashboard />
            )}

            {currentTab === 'availability' && safeEnabledTabs.includes('availability') && status === 'ready' && ministryId.length === 36 && availabilityScreen}
            
            {currentTab === 'swaps' && safeEnabledTabs.includes('swaps') && status === 'ready' && ministryId.length === 36 && swapsScreen}
            {currentTab === 'ranking' && safeEnabledTabs.includes('ranking') && status === 'ready' && ministryId.length === 36 && rankingScreen}
            
            {repertoireScreen}
            
            {currentTab === 'announcements' && safeEnabledTabs.includes('announcements') && announcementsScreen}
            
            {currentTab === 'profile' && <ProfileScreen user={activeUser!} onUpdateProfile={async (name, whatsapp, avatar, funcs, bdate) => { await Supabase.updateUserProfile(name, whatsapp, avatar, funcs, bdate, ministryId, orgId!); await refreshSession(); refreshData(); }} availableRoles={roles} />}
            {currentTab === 'history' && <HistoryScreen user={activeUser!} />}
            {currentTab === 'settings' && safeEnabledTabs.includes('settings') && settingsScreen}
            {currentTab === 'members' && isAdmin && safeEnabledTabs.includes('members') && status === 'ready' && ministryId.length === 36 && membersScreen}
            {currentTab === 'event-rules' && isAdmin && safeEnabledTabs.includes('event-rules') && status === 'ready' && ministryId.length === 36 && <EventsScreen />}
            {currentTab === 'schedule-rules' && isAdmin && safeEnabledTabs.includes('schedule-rules') && status === 'ready' && ministryId.length === 36 && <ScheduleRulesScreen ministryId={ministryId} orgId={orgId!} availableRoles={roles} members={publicMembers} />}
            {currentTab === 'plan' && isAdmin && status === 'ready' && <PlanScreen organization={organization} isAdmin={isAdmin} onRefreshOrg={async () => { await refreshSession(); }} />}
            {currentTab === 'advanced-ai' && isAdmin && isPro && status === 'ready' && ministryId.length === 36 && (
                <AdvancedAIScreen 
                    ministryId={ministryId} 
                    orgId={orgId!} 
                    orgName={organization?.name || ''}
                    ministryName={ministryTitle}
                    currentMonth={currentMonth} 
                    onMonthChange={setCurrentMonth}
                    members={publicMembers} 
                    availability={availabilityByName} 
                    schedule={schedule} 
                    attendance={attendance}
                    swapRequests={swapRequests}
                    events={events} 
                    roles={roles} 
                    onScheduleGenerated={async (assignments: any[]) => {
                        if (!Array.isArray(assignments) || assignments.length === 0) return;
                        let saved = 0;
                        for (const a of assignments) {
                            try {
                                await Supabase.saveAssignmentV2(ministryId, orgId!, {
                                    event_rule_id: a.event_rule_id,
                                    event_date:    a.event_date,
                                    role:          a.role,
                                    member_id:     a.member_id
                                });
                                saved++;
                            } catch (e) { 
                                console.error('Erro ao salvar atribuição da IA:', e); 
                            }
                        }
                        addToast(`${saved} atribuições salvas na escala.`, 'success');
                        refreshData();
                    }} 
                />
            )}
            {currentTab === 'report' && isAdmin && safeEnabledTabs.includes('report') && status === 'ready' && ministryId.length === 36 && <AvailabilityReportScreen availability={availability} availabilityNotes={availabilityNotes} registeredMembers={publicMembers} membersMap={membersMap} currentMonth={currentMonth} onMonthChange={setCurrentMonth} availableRoles={roles} onRefresh={async () => { await refreshData(); }} />}
            {currentTab === 'monthly-report' && isAdmin && safeEnabledTabs.includes('monthly-report') && status === 'ready' && ministryId.length === 36 && <MonthlyReportScreen currentMonth={currentMonth} onMonthChange={setCurrentMonth} schedule={schedule} attendance={attendance} swapRequests={swapRequests} members={publicMembers} events={events} />}
            {currentTab === 'send-announcements' && isAdmin && safeEnabledTabs.includes('send-announcements') && status === 'ready' && ministryId.length === 36 && (
                <AlertsManager 
                    orgName={organization?.name || ''}
                    ministryName={ministryTitle}
                    members={publicMembers}
                    roles={roles}
                    onSend={async (t, m, type, exp, extLink) => { 
                        if (!orgId) throw new Error("Organização não identificada.");
                        
                        try {
                            // ALTERAÇÃO 2
                            // (a) Operação principal
                            await Supabase.createAnnouncementSQL(ministryId, orgId, { title: t, message: m, type, expirationDate: exp, externalLink: extLink }, activeUser!.name);
                            
                            // (b) Operação secundária (sem await)
                            Supabase.sendNotificationSQL(ministryId, orgId, { title: t, message: m, type, actionLink: extLink || 'announcements' })
                                .catch(err => console.error("Erro na notificação (secundário):", err));
                            
                            // (c) Invalidação de cache substituindo refreshData
                            await queryClient.invalidateQueries({ queryKey: ['announcements', ministryId, orgId] });
                        } catch (err) {
                            console.error("Erro ao processar aviso:", err);
                            throw err;
                        }
                    }} 
                />
            )}
            </div>

        <InstallBanner isVisible={showInstallBanner} onInstall={() => (window as any).deferredPrompt.prompt()} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle} />
        <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
        <JoinMinistryModal 
            isOpen={showJoinModal} 
            onClose={() => setShowJoinModal(false)} 
            onJoin={async (id, r) => { 
                if (!orgId) {
                    addToast("Erro: Organização não identificada.", "error");
                    return;
                }
                try {
                    await Supabase.joinMinistry(id, orgId, r); 
                    
                    // Se for super admin ou org admin, refresha e avisa que entrou
                    // Senão, avisa que a solicitação foi enviada
                    if (activeUser?.isSuperAdmin || activeUser?.isOrgAdmin) {
                        addToast("Você entrou no ministério com sucesso!", "success");
                    } else {
                        addToast("Solicitação enviada! Aguarde a aprovação.", "info");
                    }

                    await refreshSession(); 
                    await refreshData(); 
                } catch (e: any) {
                    console.error("[onJoinMinistry]", e);
                    addToast("Erro ao processar solicitação: " + (e.message || "Tente novamente"), "error");
                    throw e;
                }
            }} 
            alreadyJoined={activeUser?.allowedMinistries || []} 
            isPro={activeUser?.isPro} 
        />
        <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ id: e.iso, title: e.title, iso: e.iso, date: e.iso.split('T')[0], time: e.iso.split('T')[1] }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId, orgId!, e); refreshData(); }} onRemove={async (id) => { await Supabase.deleteMinistryEvent(ministryId, orgId!, id); refreshData(); }} />
        <AvailabilityModal isOpen={isAvailModalOpen} onClose={() => setAvailModalOpen(false)} members={publicMembers} availability={availability} onUpdate={async (mId, d) => { 
            await Supabase.saveMemberAvailabilityV2(orgId!, ministryId, mId, d, {}, currentMonth); 
            refreshData(); 
        }} currentMonth={currentMonth} />
        <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={rawRoles} ministryName={ministryTitle} onUpdate={async (r) => { await Supabase.saveMinistrySettings(ministryId, orgId!, undefined, r); refreshData(); }} />
        
        {eventDetailsModal.isOpen && <EventDetailsModal isOpen={eventDetailsModal.isOpen} onClose={() => setEventDetailsModal({ isOpen: false, event: null })} event={eventDetailsModal.event} schedule={schedule} roles={rawRoles} allMembers={publicMembers} onSave={async (eventId, oldIso, newTitle, newTime, apply) => { const newIso = oldIso.split('T')[0] + 'T' + newTime; await Supabase.updateMinistryEvent(ministryId, orgId!, eventId, oldIso, newTitle, newIso, apply); refreshData(); setEventDetailsModal({ isOpen: false, event: null }); }} onSwapRequest={async (r, i, t) => { 
            try {
                await Supabase.createSwapRequestSQL(ministryId, orgId!, { id: '', ministryId, requesterName: activeUser!.name, requesterId: activeUser!.id || '', role: r, eventIso: i, eventTitle: t, status: 'pending', createdAt: new Date().toISOString() }); 
                addToast("Pedido de troca solicitado com sucesso.", "success");
                setEventDetailsModal({ isOpen: false, event: null }); 
            } catch (e: any) {
                addToast("Erro ao solicitar troca: " + (e.message || "Erro desconhecido"), "error");
                console.error(e);
            }
        }} currentUser={activeUser!} ministryId={ministryId} ministryName={ministryTitle} canEdit={isAdmin} />}
        <StatsModal isOpen={statsModalOpen} onClose={() => setStatsModalOpen(false)} stats={Object.values(schedule).reduce<Record<string, number>>((acc, val) => { const v = val as string; if(v) acc[v] = (acc[v] || 0) + 1; return acc; }, {})} monthName={getMonthName(currentMonth)} />
        <ConfirmationModal isOpen={!!confirmModalData} onClose={() => setConfirmModalData(null)} data={confirmModalData} onConfirm={async () => { if (confirmModalData) { await Supabase.toggleAssignmentConfirmation(ministryId, orgId!, confirmModalData.key); refreshData(); setConfirmModalData(null); addToast("Presença confirmada!", "success"); }}} />
        </Suspense>
    </DashboardLayout>
    </>
  );
};

const SupabaseHealthCheck: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'checking' | 'ok' | 'failed'>('checking');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    const pingDb = async () => {
      try {
        const sb = getSupabase();
        if (!sb) {
          throw new Error('Supabase client is null. Missing environment variables.');
        }
        // Testa a comunicação mínima com o Supabase usando Auth (que não requer acessar tabelas restritas)
        const { error } = await sb.auth.getSession();
        if (error) throw error;
        
        if (isMounted) setStatus('ok');
      } catch (e: any) {
        console.error("SupabaseHealthCheck falhou:", e);
        if (isMounted) {
          setErrorMsg(e?.message || 'Erro desconhecido');
          setStatus('failed');
        }
      }
    };
    pingDb();
    
    return () => { isMounted = false; };
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-gray-800">Conectando ao Servidor...</h2>
        <p className="text-gray-500 mt-2 text-sm">Validando sistema na plataforma Vercel</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Falha Crítica de Conexão</h2>
          <p className="text-gray-600 text-center max-w-md">
            Não foi possível estabelecer contato com a base de dados principal (Supabase).
          </p>
          <div className="mt-4 p-4 bg-gray-100 rounded text-xs font-mono text-gray-700">
            {errorMsg}
          </div>
        </div>
    );
  }

  return <>{children}</>;
};

const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache validity
      gcTime: 1000 * 60 * 15, // 15 minutes garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { LegalModal } from './components/LegalDocuments';

const App = () => {
  const docType = new URLSearchParams(window.location.search).get('doc');
  if (docType === 'terms' || docType === 'privacy') {
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center p-4">
        <LegalModal 
          isOpen={true} 
          type={docType as any} 
          onClose={() => window.location.href = '/'} 
        />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClientInstance}>
      <SupabaseHealthCheck>
        <SessionProvider>
          <ToastProvider>
            <InnerApp />
          </ToastProvider>
        </SessionProvider>
      </SupabaseHealthCheck>
    </QueryClientProvider>
  );
};

export default App;