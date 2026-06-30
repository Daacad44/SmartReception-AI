import { OnboardingGate, OnboardingOnlyRoute } from '@/components/OnboardingGate';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
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
import { TwoFactorLoginPage } from '@/pages/TwoFactorLoginPage';
import { CheckEmailPage } from '@/pages/CheckEmailPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { WelcomePage } from '@/pages/WelcomePage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { PermissionRoute } from '@/components/PermissionRoute';
import { FeatureRoute } from '@/components/FeatureRoute';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth.store';
import { ThemeProvider } from '@/components/ThemeProvider';

const ConversationsPage = lazyWithRetry(() =>
  import('@/pages/ConversationsPage').then((m) => ({ default: m.ConversationsPage }))
);
const CustomersPage = lazyWithRetry(() =>
  import('@/pages/CustomersPage').then((m) => ({ default: m.CustomersPage }))
);
const CustomerImportPage = lazyWithRetry(() =>
  import('@/pages/CustomerImportPage').then((m) => ({ default: m.CustomerImportPage }))
);
const AppointmentsPage = lazyWithRetry(() =>
  import('@/pages/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage }))
);
const AppointmentAutomationPage = lazyWithRetry(() =>
  import('@/pages/AppointmentAutomationPage').then((m) => ({ default: m.AppointmentAutomationPage }))
);
const AITrainingPage = lazyWithRetry(() =>
  import('@/pages/AITrainingPage').then((m) => ({ default: m.AITrainingPage }))
);
const AnalyticsPage = lazyWithRetry(() =>
  import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
);
const AiAnalyticsPage = lazyWithRetry(() =>
  import('@/pages/AiAnalyticsPage').then((m) => ({ default: m.AiAnalyticsPage }))
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
const GovernanceAdminPage = lazyWithRetry(() =>
  import('@/pages/GovernanceAdminPage').then((m) => ({ default: m.GovernanceAdminPage }))
);
const AiDeploymentsAdminPage = lazyWithRetry(() =>
  import('@/pages/AiDeploymentsAdminPage').then((m) => ({ default: m.AiDeploymentsAdminPage }))
);
const AiAnalyticsAdminPage = lazyWithRetry(() =>
  import('@/pages/AiAnalyticsAdminPage').then((m) => ({ default: m.AiAnalyticsAdminPage }))
);
const AiTrainingCenterAdminPage = lazyWithRetry(() =>
  import('@/pages/AiTrainingCenterAdminPage').then((m) => ({ default: m.AiTrainingCenterAdminPage }))
);
const BusinessTrainingDetailPage = lazyWithRetry(() =>
  import('@/pages/BusinessTrainingDetailPage').then((m) => ({ default: m.BusinessTrainingDetailPage }))
);
const BusinessAiAnalyticsDetailPage = lazyWithRetry(() =>
  import('@/pages/BusinessAiAnalyticsDetailPage').then((m) => ({ default: m.BusinessAiAnalyticsDetailPage }))
);
import { TrainerLoginPage } from '@/pages/TrainerLoginPage';
import {
  TrainerLayout,
  TrainerProtectedRoute,
} from '@/components/layout/TrainerLayout';
const TrainerDashboardPage = lazyWithRetry(() =>
  import('@/pages/TrainerPortalPage').then((m) => ({ default: m.TrainerDashboardPage }))
);
const TrainerJobsPage = lazyWithRetry(() =>
  import('@/pages/TrainerPortalPage').then((m) => ({ default: m.TrainerJobsPage }))
);
const TrainerSandboxPage = lazyWithRetry(() =>
  import('@/pages/TrainerPortalPage').then((m) => ({ default: m.TrainerSandboxPage }))
);
const BusinessManagementPage = lazyWithRetry(() =>
  import('@/pages/BusinessManagementPage').then((m) => ({ default: m.BusinessManagementPage }))
);
const UserManagementPage = lazyWithRetry(() =>
  import('@/pages/UserManagementPage').then((m) => ({ default: m.UserManagementPage }))
);
const CampaignsPage = lazyWithRetry(() =>
  import('@/pages/CampaignsPage').then((m) => ({ default: m.CampaignsPage }))
);
const EmployeeCommunicationPage = lazyWithRetry(() =>
  import('@/pages/EmployeeCommunicationPage').then((m) => ({ default: m.EmployeeCommunicationPage }))
);
const SubscriptionManagementPage = lazyWithRetry(() =>
  import('@/pages/SubscriptionManagementPage').then((m) => ({ default: m.SubscriptionManagementPage }))
);
const FinancialIntelligenceAdminPage = lazyWithRetry(() =>
  import('@/pages/FinancialIntelligenceAdminPage').then((m) => ({
    default: m.FinancialIntelligenceAdminPage,
  }))
);
const BusinessFinancialDetailPage = lazyWithRetry(() =>
  import('@/pages/BusinessFinancialDetailPage').then((m) => ({
    default: m.BusinessFinancialDetailPage,
  }))
);
const SubscriptionDetailsPage = lazyWithRetry(() =>
  import('@/pages/SubscriptionDetailsPage').then((m) => ({ default: m.SubscriptionDetailsPage }))
);
const SubscriptionExpiredPage = lazyWithRetry(() =>
  import('@/pages/SubscriptionExpiredPage').then((m) => ({ default: m.SubscriptionExpiredPage }))
);
const FeatureManagementAdminPage = lazyWithRetry(() =>
  import('@/pages/FeatureManagementAdminPage').then((m) => ({ default: m.FeatureManagementAdminPage }))
);
import { SubscriptionGate } from '@/components/SubscriptionGate';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (failureCount >= 3) return false;
        if (axios.isAxiosError(error) && !error.response) return true;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
    },
  },
});

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (isAuthenticated && accessToken) {
    return <Navigate to="/" replace />;
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
                <Route path="/verify-2fa" element={<TwoFactorLoginPage />} />
                <Route path="/accept-invite" element={<AcceptInvitePage />} />
                <Route path="/check-email" element={<CheckEmailPage />} />
                <Route
                  path="/onboarding"
                  element={
                    <OnboardingOnlyRoute>
                      <OnboardingPage />
                    </OnboardingOnlyRoute>
                  }
                />
                <Route
                  path="/welcome"
                  element={
                    <ProtectedRoute>
                      <WelcomePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/subscription-expired"
                  element={
                    <ProtectedRoute>
                      <SubscriptionExpiredPage />
                    </ProtectedRoute>
                  }
                />
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
                <Route path="/trainer/login" element={<TrainerLoginPage />} />
                <Route
                  path="/trainer"
                  element={
                    <TrainerProtectedRoute>
                      <TrainerLayout />
                    </TrainerProtectedRoute>
                  }
                >
                  <Route index element={<TrainerDashboardPage />} />
                  <Route path="jobs" element={<TrainerJobsPage />} />
                  <Route path="sandbox" element={<TrainerSandboxPage />} />
                </Route>
                <Route
                  element={
                    <SubscriptionGate>
                      <OnboardingGate>
                        <ProtectedRoute>
                          <DashboardLayout />
                        </ProtectedRoute>
                      </OnboardingGate>
                    </SubscriptionGate>
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
                    path="/customers/import"
                    element={
                      <PermissionRoute permission={PERMISSIONS['customers:write']}>
                        <CustomerImportPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/appointments/automation"
                    element={
                      <PermissionRoute permission={PERMISSIONS['appointments:read']}>
                        <FeatureRoute featureKey="appointment-automation">
                          <AppointmentAutomationPage />
                        </FeatureRoute>
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
                    path="/campaigns"
                    element={
                      <PermissionRoute permission={PERMISSIONS['campaigns:read']}>
                        <FeatureRoute featureKey="campaigns">
                          <CampaignsPage />
                        </FeatureRoute>
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/employee-comms"
                    element={
                      <PermissionRoute permission={PERMISSIONS['employee-comms:read']}>
                        <FeatureRoute featureKey="employee-comms">
                          <EmployeeCommunicationPage />
                        </FeatureRoute>
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/knowledge"
                    element={<Navigate to="/ai-training" replace />}
                  />
                  <Route
                    path="/ai-training"
                    element={
                      <PermissionRoute permission={PERMISSIONS['knowledge:read']}>
                        <AITrainingPage />
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
                    path="/ai-analytics"
                    element={
                      <PermissionRoute permission={PERMISSIONS['analytics:read']}>
                        <FeatureRoute featureKey="ai-analytics">
                          <AiAnalyticsPage />
                        </FeatureRoute>
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
                  <Route
                    path="/admin/ai-training"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <AiTrainingCenterAdminPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/ai-training/:businessId"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <BusinessTrainingDetailPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/ai-analytics"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <AiAnalyticsAdminPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/ai-analytics/:businessId"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <BusinessAiAnalyticsDetailPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/businesses"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <BusinessManagementPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <UserManagementPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/subscriptions"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <SubscriptionManagementPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/financial-intelligence"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <FeatureRoute featureKey="financial-intelligence">
                          <FinancialIntelligenceAdminPage />
                        </FeatureRoute>
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/financial-intelligence/:businessId"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <FeatureRoute featureKey="financial-intelligence">
                          <BusinessFinancialDetailPage />
                        </FeatureRoute>
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/governance"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <FeatureRoute featureKey="governance-admin">
                          <GovernanceAdminPage />
                        </FeatureRoute>
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/feature-management"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <FeatureRoute featureKey="feature-management">
                          <FeatureManagementAdminPage />
                        </FeatureRoute>
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/ai-deployments"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <AiDeploymentsAdminPage />
                      </PermissionRoute>
                    }
                  />
                  <Route
                    path="/admin/subscriptions/:businessId"
                    element={
                      <PermissionRoute permission={PERMISSIONS['platform:admin']}>
                        <SubscriptionDetailsPage />
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
