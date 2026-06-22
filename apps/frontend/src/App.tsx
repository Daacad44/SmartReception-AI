import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { HydrationGate } from '@/components/HydrationGate';
import { RootRedirect } from '@/components/RootRedirect';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { VerifyOtpPage } from '@/pages/VerifyOtpPage';
import { CheckEmailPage } from '@/pages/CheckEmailPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { PermissionRoute } from '@/components/PermissionRoute';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth.store';
import { ThemeProvider } from '@/components/ThemeProvider';

const ConversationsPage = lazyWithRetry(() =>
  import('@/pages/ConversationsPage').then((m) => ({ default: m.ConversationsPage }))
);
const CustomersPage = lazyWithRetry(() =>
  import('@/pages/CustomersPage').then((m) => ({ default: m.CustomersPage }))
);
const AppointmentsPage = lazyWithRetry(() =>
  import('@/pages/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage }))
);
const KnowledgeBasePage = lazyWithRetry(() =>
  import('@/pages/KnowledgeBasePage').then((m) => ({ default: m.KnowledgeBasePage }))
);
const AnalyticsPage = lazyWithRetry(() =>
  import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
);
const TeamPage = lazyWithRetry(() =>
  import('@/pages/TeamPage').then((m) => ({ default: m.TeamPage }))
);
const SettingsPage = lazyWithRetry(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const BillingPage = lazyWithRetry(() =>
  import('@/pages/BillingPage').then((m) => ({ default: m.BillingPage }))
);
const NotificationsPage = lazyWithRetry(() =>
  import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const AuditLogsPage = lazyWithRetry(() =>
  import('@/pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage }))
);
const SuperAdminPage = lazyWithRetry(() =>
  import('@/pages/SuperAdminPage').then((m) => ({ default: m.SuperAdminPage }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
    },
  },
});

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (isAuthenticated && accessToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <HydrationGate>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<RootRedirect />} />
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
                <Route path="/accept-invite" element={<AcceptInvitePage />} />
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
                      <PermissionRoute permission={PERMISSIONS['analytics:read']}>
                        <DashboardPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/conversations"
                    element={
                      <PermissionRoute permission={PERMISSIONS['conversations:read']}>
                        <ConversationsPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/customers"
                    element={
                      <PermissionRoute permission={PERMISSIONS['customers:read']}>
                        <CustomersPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/appointments"
                    element={
                      <PermissionRoute permission={PERMISSIONS['appointments:read']}>
                        <AppointmentsPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/knowledge"
                    element={
                      <PermissionRoute permission={PERMISSIONS['knowledge:read']}>
                        <KnowledgeBasePage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <PermissionRoute permission={PERMISSIONS['analytics:read']}>
                        <AnalyticsPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/team"
                    element={
                      <PermissionRoute permission={PERMISSIONS['team:read']}>
                        <TeamPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <PermissionRoute permission={PERMISSIONS['settings:read']}>
                        <SettingsPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/billing"
                    element={
                      <PermissionRoute permission={PERMISSIONS['billing:read']}>
                        <BillingPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <PermissionRoute permission={PERMISSIONS['conversations:read']}>
                        <NotificationsPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/audit-logs"
                    element={
                      <PermissionRoute permission={PERMISSIONS['audit:read']}>
                        <AuditLogsPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/super-admin"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <SuperAdminPage />
                      </PermissionRoute>
                    }
                  />
                </Route>
                <Route path="*" element={<RootRedirect />} />
              </Routes>
            </BrowserRouter>
            <Toaster position="top-right" richColors />
          </TooltipProvider>
        </QueryClientProvider>
      </HydrationGate>
    </ThemeProvider>
  );
}
