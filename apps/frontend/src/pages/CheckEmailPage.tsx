import { Link, useSearchParams } from 'react-router-dom';
import { Bot, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function CheckEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No email address provided.</p>
            <Button asChild variant="link" className="mt-4">
              <Link to="/register">Create an account</Link>
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
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We sent a verification code to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-4 py-3">
            <Mail className="h-4 w-4 text-accent" />
            <span className="font-medium">{email}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your email to verify your account and continue to business setup.
          </p>
          <Button asChild className="w-full bg-accent hover:bg-accent/90">
            <Link to={`/verify-otp?email=${encodeURIComponent(email)}`}>
              Enter verification code
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Didn&apos;t receive the email? Check spam or{' '}
            <Link to={`/verify-otp?email=${encodeURIComponent(email)}`} className="text-accent hover:underline">
              resend code
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
