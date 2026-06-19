import { useSearchParams, Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

export function CheckEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const { resendVerification, isResendingVerification } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
            <Mail className="h-6 w-6 text-accent" />
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Click the link in the email to verify your account. You must verify before signing in.
          </p>
          <Button
            variant="outline"
            className="w-full"
            disabled={!email || isResendingVerification}
            onClick={() => resendVerification(email)}
          >
            {isResendingVerification ? 'Sending...' : 'Resend verification email'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already verified?{' '}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
