import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OtpInput } from '@/components/OtpInput';
import { useAuth } from '@/hooks/useAuth';

const RESEND_COOLDOWN = 60;

export function ActivatePage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);

  const { verifyApproval, resendApproval, isVerifyingApproval, isResendingApproval } = useAuth();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = () => {
    if (code.length !== 6 || !email) return;
    verifyApproval({ email, code });
  };

  const handleResend = () => {
    if (!email || countdown > 0) return;
    resendApproval(email, { onSuccess: () => setCountdown(RESEND_COOLDOWN) });
  };

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Missing email address.</p>
            <Button asChild variant="link" className="mt-4">
              <Link to="/login">Back to sign in</Link>
            </Button>
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
            <ShieldCheck className="h-6 w-6 text-accent" />
          </div>
          <CardTitle className="text-2xl">Activate your account</CardTitle>
          <CardDescription>
            Your business was approved. Enter the activation code sent to{' '}
            <strong className="text-foreground">{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <OtpInput value={code} onChange={setCode} disabled={isVerifyingApproval} />

          <Button
            className="w-full bg-accent hover:bg-accent/90"
            disabled={code.length !== 6 || isVerifyingApproval}
            onClick={handleVerify}
          >
            {isVerifyingApproval ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : (
              'Activate & Continue'
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {countdown > 0 ? (
              <p>Resend code in {countdown}s</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResendingApproval}
                className="font-medium text-accent hover:underline disabled:opacity-50"
              >
                {isResendingApproval ? 'Sending...' : 'Resend activation code'}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            The code expires in 30 minutes. If it expires, request a new one above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
