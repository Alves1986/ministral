
export type Role = string;

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  active?: boolean;
  logo_url?: string;
  logo_path?: string;
  createdAt?: string;
  userCount?: number;
  ministryCount?: number;
  ministries?: MinistryDef[];
  // Billing & Access Control
  plan_type?: 'trial' | 'pro' | 'enterprise';
  billing_status?: 'active' | 'past_due' | 'canceled' | 'trial';
  whatsapp_enabled?: boolean;
  trial_ends_at?: string;
  checkout_url?: string;
  access_locked?: boolean;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
}

export interface MinistryDef {
  id: string;   
  code: string; 
  label: string; 
  enabledTabs?: string[]; 
  organizationId?: string; 
  qrCodeUrl?:      string;
  socialLinkUrl?:  string;
  whatsapp_enabled?: boolean;
}

export interface MemberMap {
  [role: string]: string[];
}

export interface ScheduleMap {
  [key: string]: string; 
}

export interface AttendanceMap {
  [key: string]: boolean;
}

export interface CustomEvent {
  id: string;
  title: string;
  date: string; 
  time: string; 
  iso: string; 
  organizationId?: string; 
}

export interface AvailabilityMap {
  [memberName: string]: string[]; 
}

export interface AvailabilityNotesMap {
  [key: string]: string; 
}

export interface MinistrySettings {
    id?: string;
    organizationMinistryId?: string;
    displayName: string;
    roles: string[];
    availabilityStart?: string;
    availabilityEnd?: string;
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    youtubeApiKey?: string;
    organizationId?: string;
    qrCodeUrl?:      string;
    socialLinkUrl?:  string;
    quickAccessItems?: string[];
    whatsappCustomMessage?: string; // Mensagem customizada para lembretes WhatsApp
}

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionLink?: string;
  ministryId?: string; 
  ministryName?: string;
  organizationId?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  timestamp: string;
  expirationDate?: string; 
  author: string;
  externalLink?: string;
  isPinned?: boolean;
  readBy: { userId: string; name: string; timestamp: string }[];
  likedBy: { userId: string; name: string; timestamp: string }[]; 
  organizationId?: string;
}

export interface ScheduleIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  suggestedReplacement?: string;
}

export interface ScheduleAnalysis {
  [key: string]: ScheduleIssue;
}

export const ALL_TABS = [
  'dashboard', 
  'announcements', 
  'calendar', 
  'availability', 
  'swaps', 
  'repertoire', 
  'ranking', 
  'history',
  'settings',
  'schedule-editor',
  'monthly-report',
  'repertoire-manager',
  'report',
  'event-rules',
  'schedule-rules',
  'plan',
  'send-announcements',
  'members',
  'super-admin',
  'advanced-ai',
  // Super Admin exclusive tabs
  'sa-organizations',
  'sa-whatsapp',
  'sa-telemetry',
];

export const DEFAULT_TABS = [...ALL_TABS];

export interface GlobalConflict {
    ministryId: string; 
    eventIso: string;   
    role: string;       
}

export interface GlobalConflictMap {
    [normalizedMemberName: string]: GlobalConflict[];
}

export interface SwapRequest {
  id: string;
  ministryId: string;
  requesterName: string;
  requesterId?: string;
  role: string;
  eventIso: string; 
  eventTitle: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  takenByName?: string;
  organizationId?: string;
}

export interface RepertoireItem {
  id: string;
  title: string;
  link: string;
  date: string; 
  observation?: string;
  addedBy: string;
  createdAt: string;
  content?: string; 
  key?: string; 
  organizationId?: string;
}

export interface User {
  id?: string;        
  email?: string;     
  username?: string;  
  name: string;       
  avatar_url?: string; 
  access_role: 'admin' | 'member';
  ministryId?: string; 
  allowedMinistries?: string[]; 
  organizationId?: string; 
  isSuperAdmin?: boolean; 
  isOrgAdmin?: boolean;
  isPro?: boolean;
  isEnterprise?: boolean;
  whatsapp?: string;
  birthDate?: string; 
  ministry_functions?: string[];
  createdAt?: string;
}

export interface AuthenticatedUser extends User {
  id: string;
  organizationId: string;
  ministryId: string;
}

export interface TeamMemberProfile {
    id: string;
    name: string;
    email?: string;
    whatsapp?: string;
    birthDate?: string; 
    avatar_url?: string;
    ministry_functions?: string[]; // Funcoes vindas de ministry_members.functions (mapeado pelo fetchMinistryMembers)
    createdAt?: string;
    isAdmin?: boolean;
    organizationId?: string;
}

export interface AppState {
  organizationId: string | null;
  ministryId: string | null;
  currentUser: User | null;
  currentMonth: string; 
  members: MemberMap;
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  customEvents: CustomEvent[];
  availability: AvailabilityMap;
  roles: string[];
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
}

export interface RankingHistoryItem {
    id: string;
    date: string;
    description: string;
    points: number;
    type:
      | 'assignment'
      | 'swap_assumed'
      | 'availability'
      | 'checkin_miss'
      | 'profile_complete'
      | 'month_complete'
      | 'streak_bonus'
      | 'announcement_read'
      | 'announcement_like'
      | 'redeem'
      | 'manual_adjust';
}

export interface RankingEntry {
    memberId: string;
    name: string;
    avatar_url?: string;
    points: number;
    stats: {
        confirmedEvents: number;
        swapsAssumed: number;
        checkinMisses: number;
        streakBonuses: number;
        announcementsRead: number;
        announcementsLiked: number;
    };
    gloryCoinBalance: number;    // saldo atual
    gloryCoinEarned: number;     // total historico ganho no ano
    history: RankingHistoryItem[];
}

export const DEFAULT_ROLES: Record<string, string[]> = {
  'midia': ['Projeção', 'Transmissão', 'Fotografia', 'Stories', 'Câmera Móvel', 'Apresentador(a)'],
  'louvor': ['Ministro', 'Vocal', 'Violão', 'Guitarra', 'Bateria', 'Baixo', 'Teclado', 'Mesa de Som'],
  'infantil': ['Lanche', 'Professor 03–06', 'Professor 07–11'],
  'default': ["Membro"]
};

export interface WhatsAppSettings {
    id: string;
    org_id: string;
    enabled: boolean;
    send_days_before: number;
    send_time: string;
    updated_at: string;
}