import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LazyRoute } from '@/components/LazyRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { VerifyOtpPage } from '@/pages/VerifyOtpPage';
import { CheckEmailPage } from '@/pages/CheckEmailPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { useAuthStore } from '@/stores/auth.store';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthBootstrap } from '@/components/AuthBootstrap';

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const ConversationsPage = lazy(() =>
  import('@/pages/ConversationsPage').then((m) => ({ default: m.ConversationsPage }))
);
const CustomersPage = lazy(() =>
  import('@/pages/CustomersPage').then((m) => ({ default: m.CustomersPage }))
);
const AppointmentsPage = lazy(() =>
  import('@/pages/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage }))
);
const KnowledgeBasePage = lazy(() =>
  import('@/pages/KnowledgeBasePage').then((m) => ({ default: m.KnowledgeBasePage }))
);
const AnalyticsPage = lazy(() =>
  import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
);
const TeamPage = lazy(() => import('@/pages/TeamPage').then((m) => ({ default: m.TeamPage })));
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const BillingPage = lazy(() =>
  import('@/pages/BillingPage').then((m) => ({ default: m.BillingPage }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PublicRoute({ children }: { children: React.ReactNode }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!hasHydrated) {
    return null;
  }

  if (isAuthenticated && accessToken) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthBootstrap />
      <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />
            <Route path="/verify-otp" element={<VerifyOtpPage />} />
            <Route path="/check-email" element={<CheckEmailPage />} />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPasswordPage />
                </PublicRoute>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicRoute>
                  <ResetPasswordPage />
                </PublicRoute>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <LazyRoute>
                    <DashboardPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/conversations"
                element={
                  <LazyRoute>
                    <ConversationsPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/customers"
                element={
                  <LazyRoute>
                    <CustomersPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/appointments"
                element={
                  <LazyRoute>
                    <AppointmentsPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/knowledge"
                element={
                  <LazyRoute>
                    <KnowledgeBasePage />
                  </LazyRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <LazyRoute>
                    <AnalyticsPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/team"
                element={
                  <LazyRoute>
                    <TeamPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <LazyRoute>
                    <SettingsPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/billing"
                element={
                  <LazyRoute>
                    <BillingPage />
                  </LazyRoute>
                }
              />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
