import { useSearchParams, Link } from 'react-router-dom';
import { Clock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogoMark } from '@/components/Logo';

export function ApplicationPendingPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy">
            <LogoMark size={30} />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <Clock className="h-5 w-5 text-accent" />
            Application under review
          </CardTitle>
          <CardDescription>
            Thanks for applying to SomReception AI. Your business is now being reviewed by our team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="flex items-start gap-2 text-muted-foreground">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                Once a Super Admin approves your application, we'll email{' '}
                {email ? (
                  <strong className="text-foreground">{email}</strong>
                ) : (
                  'you'
                )}{' '}
                an activation code to finish setting up your account.
              </span>
            </p>
          </div>

          <div className="space-y-2 text-center text-sm">
            <p className="text-muted-foreground">Already have an activation code?</p>
            <Button asChild variant="accent" className="w-full">
              <Link to={`/activate${email ? `?email=${encodeURIComponent(email)}` : ''}`}>
                Enter activation code
              </Link>
            </Button>
          </div>

          <p className="text-center text-sm">
            <Link to="/login" className="font-medium text-accent hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
