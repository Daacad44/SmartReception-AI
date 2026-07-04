import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Bot, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OtpInput } from '@/components/OtpInput';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';
import type { UserProfile } from '@/lib/types';

const RESEND_COOLDOWN = 60;

export function VerifyOtpPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [verified, setVerified] = useState(false);
  const login = useAuthStore((s) => s.login);

  const { verifyOtp, resendOtp, isVerifyingOtp, isResendingOtp } = useAuth();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = () => {
    if (code.length !== 6 || !email) return;
    verifyOtp(
      { email, code },
      {
        onSuccess: (data) => {
          if (data.accessToken && data.refreshToken && data.user) {
            const profile: UserProfile = {
              id: data.user.id,
              email: data.user.email,
              firstName: data.user.firstName,
              lastName: data.user.lastName,
              role: data.businesses?.[0]?.role ?? 'OWNER',
              businesses: (data.businesses ?? []).map((b) => ({
                id: b.id,
                name: b.name,
                industry: b.industry ?? 'OTHER',
                plan: b.plan ?? 'FREE',
                role: b.role,
              })),
            };
            login(data.accessToken, data.refreshToken, profile);
          }
          setVerified(true);
          toast.success('Email verified!');
          setTimeout(() => {
            navigate(data.requiresOnboarding !== false ? '/onboarding' : '/dashboard');
          }, 1500);
        },
        onError: () => toast.error('Invalid or expired code'),
      }
    );
  };

  const handleResend = () => {
    if (!email || countdown > 0) return;
    resendOtp(email, { onSuccess: () => setCountdown(RESEND_COOLDOWN) });
  };

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Missing email address.</p>
            <Button asChild variant="link" className="mt-4">
              <Link to="/register">Create an account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-semibold">Email verified!</h2>
            <p className="mt-2 text-sm text-muted-foreground">Setting up your business workspace...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-navy">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to <strong className="text-foreground">{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <OtpInput value={code} onChange={setCode} disabled={isVerifyingOtp} />

          <Button
            className="w-full bg-accent hover:bg-accent/90"
            disabled={code.length !== 6 || isVerifyingOtp}
            onClick={handleVerify}
          >
            {isVerifyingOtp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Continue'
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {countdown > 0 ? (
              <p>Resend code in {countdown}s</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResendingOtp}
                className="font-medium text-accent hover:underline disabled:opacity-50"
              >
                {isResendingOtp ? 'Sending...' : 'Resend code'}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Code expires in 10 minutes. Never share it with anyone.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
