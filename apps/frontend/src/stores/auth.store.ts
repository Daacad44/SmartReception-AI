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
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserProfile) => void;
  setBusinesses: (businesses: Business[]) => void;
  setCurrentBusiness: (businessId: string) => void;
  login: (accessToken: string, refreshToken: string, user: UserProfile) => void;
  logout: () => void;
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

      login: (accessToken, refreshToken, user) =>
        set({
          accessToken,
          refreshToken,
          user,
          businesses: user.businesses.map((b) => ({
            id: b.id,
            name: b.name,
            industry: b.industry,
            plan: b.plan,
          })),
          currentBusinessId: user.businesses[0]?.id ?? null,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          businesses: [],
          currentBusinessId: null,
          isAuthenticated: false,
        }),
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
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          useAuthStore.getState().setHasHydrated(true);
          return;
        }

        if (state?.isAuthenticated && !state.accessToken) {
          useAuthStore.getState().logout();
        }
      },
    }
  )
);

// Reliable hydration detection (onRehydrateStorage alone can miss in some browsers)
useAuthStore.persist.onFinishHydration(() => {
  useAuthStore.getState().setHasHydrated(true);
});

if (useAuthStore.persist.hasHydrated()) {
  useAuthStore.getState().setHasHydrated(true);
}
