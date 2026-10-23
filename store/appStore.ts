
import { create } from 'zustand';
import { User, ThemeMode, MinistryDef } from '../types';

interface AppState {
  currentUser: User | null;
  ministryId: string;
  organizationId: string | null;
  availableMinistries: MinistryDef[]; 
  themeMode: ThemeMode;
  sidebarOpen: boolean;
  isAppReady: boolean; // NEW: Global readiness flag
  
  setCurrentUser: (user: User | null) => void;
  setMinistryId: (id: string) => void;
  setOrganizationId: (id: string | null) => void;
  setAvailableMinistries: (ministries: MinistryDef[]) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAppReady: (ready: boolean) => void; // NEW
}

const storedMinistryId = typeof window !== 'undefined' ? localStorage.getItem('ministry_id') : null;

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  ministryId: storedMinistryId || '', 
  organizationId: null,
  availableMinistries: [],
  themeMode: (localStorage.getItem('themeMode') as ThemeMode) || 'system',
  sidebarOpen: false,
  isAppReady: false, // Default to false

  setCurrentUser: (user) => set((state) => {
      if (!user) {
          return { currentUser: null, organizationId: null, isAppReady: false };
      }

      // Super Admin global não tem organizationId — é um caso especial válido.
      // Apenas usuários normais (sem isSuperAdmin) precisam ter organizationId.
      if (!user.isSuperAdmin && !user.organizationId) {
          console.error("[STORE] Attempted to set user without organizationId. Action blocked.");
          return state; // Retorna estado anterior, rejeita atualização inválida
      }

      // Valida se o ID existente no store é permitido para este usuário
      const currentId = state.ministryId;
      const incomingId = user.ministryId;
      const allowed = user.allowedMinistries || [];

      let newMinistryId = '';
      if (currentId && (allowed.length === 0 || allowed.includes(currentId))) {
          newMinistryId = currentId;
      } else if (incomingId && (allowed.length === 0 || allowed.includes(incomingId))) {
          newMinistryId = incomingId;
      } else if (allowed.length > 0) {
          newMinistryId = allowed[0];
      }

      if (newMinistryId && typeof window !== 'undefined') {
          localStorage.setItem('ministry_id', newMinistryId);
      }

      return { 
          currentUser: {
              ...user,
              ministryId: newMinistryId || user.ministryId
          }, 
          ministryId: newMinistryId,
          organizationId: user.organizationId,
          isAppReady: true 
      };
  }),
  setMinistryId: (id) => {
      if (typeof window !== 'undefined') localStorage.setItem('ministry_id', id);
      set((state) => ({ 
          ministryId: id,
          currentUser: state.currentUser ? { ...state.currentUser, ministryId: id } : null
      }));
  },
  setOrganizationId: (id) => set({ organizationId: id }),
  setAvailableMinistries: (ministries) => set({ availableMinistries: ministries }),
  setThemeMode: (mode) => {
      localStorage.setItem('themeMode', mode);
      set({ themeMode: mode });
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setAppReady: (ready) => set({ isAppReady: ready }),
}));
