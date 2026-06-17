import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bot, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api, { getErrorMessage } from '@/lib/api';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }

    api
      .get('/auth/verify-email', { params: { token } })
      .then((res) => {
        const body = res.data as { success?: boolean; data?: { message?: string } };
        setStatus('success');
        setMessage(body.data?.message || 'Email verified successfully.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(getErrorMessage(err));
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-navy">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Email Verification</CardTitle>
          <CardDescription>SmartReception AI</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Verifying your email...</p>
            </div>
          )}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button asChild className="w-full bg-accent hover:bg-accent/90">
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          )}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
