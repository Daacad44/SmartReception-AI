import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Bot, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OtpInput } from '@/components/OtpInput';
import { useAuth } from '@/hooks/useAuth';

export function TwoFactorLoginPage() {
  const [searchParams] = useSearchParams();
  const tempToken = searchParams.get('tempToken') || '';
  const [code, setCode] = useState('');
  const { verifyTwoFactorLogin, isVerifyingTwoFactor } = useAuth();

  const handleVerify = () => {
    if (code.length < 6 || !tempToken) return;
    verifyTwoFactorLogin({ tempToken, code });
  };

  if (!tempToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Invalid or expired verification session.</p>
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
            <Bot className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <Shield className="h-5 w-5 text-accent" />
            Two-factor authentication
          </CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app, or a backup code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="sr-only">Authentication code</Label>
            <OtpInput value={code} onChange={setCode} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="backup-code" className="text-xs text-muted-foreground">
              Or enter backup code
            </Label>
            <Input
              id="backup-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
              placeholder="Backup code"
              maxLength={8}
              autoComplete="one-time-code"
            />
          </div>
          <Button
            className="w-full bg-accent hover:bg-accent/90"
            onClick={handleVerify}
            disabled={code.length < 6 || isVerifyingTwoFactor}
          >
            {isVerifyingTwoFactor ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & sign in'
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-accent hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
