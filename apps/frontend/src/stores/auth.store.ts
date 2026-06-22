import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '@/lib/types';
import type { Business } from '@/lib/entities';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  businesses: Business[];
  currentBusinessId: string | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserProfile) => void;
  setBusinesses: (businesses: Business[]) => void;
  setCurrentBusiness: (businessId: string) => void;
  login: (accessToken: string, refreshToken: string, user: UserProfile, isSuperAdmin?: boolean) => void;
  logout: () => void;
}

function markHydrated() {
  useAuthStore.getState().setHasHydrated(true);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      businesses: [],
      currentBusinessId: null,
      isAuthenticated: false,
      isSuperAdmin: false,
      hasHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      setBusinesses: (businesses) =>
        set({
          businesses,
          currentBusinessId: businesses[0]?.id ?? null,
        }),

      setCurrentBusiness: (businessId) => set({ currentBusinessId: businessId }),

      login: (accessToken, refreshToken, user, isSuperAdmin = false) =>
        set({
          accessToken,
          refreshToken,
          user,
          businesses: (user.businesses ?? []).map((b) => ({
            id: b.id,
            name: b.name,
            industry: b.industry,
            plan: b.plan,
            role: b.role,
          })),
          currentBusinessId: user.businesses?.[0]?.id ?? null,
          isAuthenticated: true,
          isSuperAdmin,
          hasHydrated: true,
        }),

      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          businesses: [],
          currentBusinessId: null,
          isAuthenticated: false,
          isSuperAdmin: false,
          hasHydrated: true,
        });
      },
    }),
    {
      name: 'smartreception-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        businesses: state.businesses,
        currentBusinessId: state.currentBusinessId,
        isAuthenticated: state.isAuthenticated,
        isSuperAdmin: state.isSuperAdmin,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!error && state?.isAuthenticated && !state.accessToken) {
          useAuthStore.getState().logout();
        }
        markHydrated();
      },
    }
  )
);

useAuthStore.persist.onFinishHydration(markHydrated);

if (useAuthStore.persist.hasHydrated()) {
  markHydrated();
}
