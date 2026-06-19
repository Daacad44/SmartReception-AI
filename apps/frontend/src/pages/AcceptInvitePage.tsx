import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAcceptInvite } from '@/hooks/useMutations';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const acceptInvite = useAcceptInvite();
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`);
      return;
    }
    if (accepted || acceptInvite.isPending || acceptInvite.isSuccess) return;

    acceptInvite.mutate(token, {
      onSuccess: (data) => {
        const result = data as { businessName?: string };
        setAccepted(true);
        toast.success(`Joined ${result?.businessName ?? 'workspace'}`);
        navigate('/dashboard');
      },
    });
  }, [token, isAuthenticated, accepted, acceptInvite, navigate]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>This invitation link is missing or invalid.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accepting Invitation</CardTitle>
          <CardDescription>
            {acceptInvite.isPending && 'Joining workspace...'}
            {acceptInvite.isError && 'Unable to accept invitation. Ensure you are logged in with the invited email.'}
            {accepted && 'Redirecting to dashboard...'}
          </CardDescription>
        </CardHeader>
        {acceptInvite.isError && (
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
