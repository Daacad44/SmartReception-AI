import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandLogo } from '@/components/Logo';
import { useAcceptInvite, useRegisterFromInvite } from '@/hooks/useMutations';
import { useAuthStore } from '@/stores/auth.store';
import api, { extractData, getErrorMessage, isNetworkOrTimeoutError } from '@/lib/api';
import { toast } from 'sonner';
import { LoadingState } from '@/components/LoadingState';

interface InvitationPreview {
  email: string;
  role: string;
  status: string;
  acceptable: boolean;
  accountExists: boolean;
  expiresAt: string;
  businessName: string;
  inviterName?: string | null;
}

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentEmail = useAuthStore((s) => s.user?.email);
  const acceptInvite = useAcceptInvite();
  const registerFromInvite = useRegisterFromInvite();
  const [registerForm, setRegisterForm] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });

  const previewQuery = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: async () => {
      const response = await api.get('/team/invitations/preview', { params: { token } });
      return extractData<InvitationPreview>(response);
    },
    enabled: token.length >= 16,
    retry: false,
  });

  const loginUrl = `/login?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`;
  const preview = previewQuery.data;
  const emailMismatch = Boolean(
    isAuthenticated && preview?.email && currentEmail && preview.email.toLowerCase() !== currentEmail.toLowerCase()
  );

  const roleLabel = useMemo(() => {
    if (!preview?.role) return '';
    return preview.role.charAt(0) + preview.role.slice(1).toLowerCase();
  }, [preview?.role]);

  const completeJoin = (businessName?: string) => {
    toast.success(`Joined ${businessName ?? preview?.businessName ?? 'workspace'}`);
    navigate('/dashboard');
  };

  const handleAccept = async () => {
    try {
      const data = await acceptInvite.mutateAsync(token);
      completeJoin(data.businessName);
    } catch {
      // Error toast is handled by the mutation.
    }
  };

  const handleRegister = async () => {
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      const data = await registerFromInvite.mutateAsync({
        token,
        firstName: registerForm.firstName,
        lastName: registerForm.lastName,
        password: registerForm.password,
        confirmPassword: registerForm.confirmPassword,
      });
      completeJoin(data.businessName);
    } catch {
      // Error toast is handled by the mutation.
    }
  };

  if (!token) {
    return (
      <CenteredCard
        title="Invalid Invitation"
        description="This invitation link is missing or invalid."
      />
    );
  }

  if (previewQuery.isLoading) {
    return (
      <CenteredCard title="Checking invitation" description="Please wait while we verify this invitation.">
        <LoadingState rows={3} />
      </CenteredCard>
    );
  }

  if (previewQuery.isError || !preview) {
    return (
      <CenteredCard
        title="Invitation unavailable"
        description={
          isNetworkOrTimeoutError(previewQuery.error)
            ? 'Unable to verify this invitation right now. Please try again.'
            : getErrorMessage(previewQuery.error) || 'This invitation is invalid or has expired.'
        }
      >
        <Button className="w-full" asChild>
          <Link to="/login">Go to Login</Link>
        </Button>
      </CenteredCard>
    );
  }

  if (!preview.acceptable) {
    return (
      <CenteredCard
        title="Invitation cannot be accepted"
        description={`This invitation is ${preview.status.toLowerCase()}. Ask a workspace admin to send a new invitation if you still need access.`}
      >
        <Button className="w-full" asChild>
          <Link to="/login">Go to Login</Link>
        </Button>
      </CenteredCard>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex justify-center">
            <BrandLogo variant="app-icon" className="h-16 w-16" />
          </div>
          <CardTitle>Join {preview.businessName}</CardTitle>
          <CardDescription>
            {preview.inviterName ? `${preview.inviterName} invited you` : 'You were invited'} to join as {roleLabel}.
            This invitation expires on {new Date(preview.expiresAt).toLocaleString()}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md bg-muted px-3 py-2 text-sm">Invited email: {preview.email}</p>

          {emailMismatch && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                You are signed in as {currentEmail}. Sign in with {preview.email} to accept this invitation.
              </p>
              <Button className="w-full" asChild>
                <Link to={loginUrl}>Sign in with invited email</Link>
              </Button>
            </div>
          )}

          {!isAuthenticated && preview.accountExists && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                An account already exists for this email. Sign in to accept the invitation.
              </p>
              <Button className="w-full" asChild>
                <Link to={loginUrl}>Sign in to accept</Link>
              </Button>
            </div>
          )}

          {!isAuthenticated && !preview.accountExists && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleRegister();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="invite-first-name">First name</Label>
                  <Input
                    id="invite-first-name"
                    value={registerForm.firstName}
                    onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="invite-last-name">Last name</Label>
                  <Input
                    id="invite-last-name"
                    value={registerForm.lastName}
                    onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-password">Password</Label>
                <Input
                  id="invite-password"
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-confirm-password">Confirm password</Label>
                <Input
                  id="invite-confirm-password"
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
              <Button className="w-full" type="submit" disabled={registerFromInvite.isPending}>
                {registerFromInvite.isPending ? 'Creating account...' : 'Create account and join'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{' '}
                <Link to={loginUrl} className="underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {isAuthenticated && !emailMismatch && (
            <Button className="w-full" onClick={() => void handleAccept()} disabled={acceptInvite.isPending}>
              {acceptInvite.isPending ? 'Joining workspace...' : 'Accept invitation'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CenteredCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex justify-center">
            <BrandLogo variant="app-icon" className="h-16 w-16" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children ? <CardContent>{children}</CardContent> : null}
      </Card>
    </div>
  );
}
