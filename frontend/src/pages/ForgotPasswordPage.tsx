import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLogo } from '@/components/Logo';
import { BRAND_CTA_CLASS } from '@/lib/brand';
import { useAuth } from '@/hooks/useAuth';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type ForgotPasswordForm = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { forgotPassword, isSendingReset } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-5 flex justify-center bg-transparent">
            <BrandLogo variant="app-icon" className="h-16 w-16" />
          </div>
          <CardTitle className="text-2xl">Forgot password</CardTitle>
          <CardDescription>We&apos;ll send a 6-digit code to your email (expires in 10 minutes)</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((data) =>
              forgotPassword(data.email, {
                onSuccess: () => navigate(`/reset-password?email=${encodeURIComponent(data.email)}`),
              })
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" className="pl-9" {...register('email')} />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <Button type="submit" className={`w-full ${BRAND_CTA_CLASS}`} disabled={isSendingReset}>
              {isSendingReset ? 'Sending...' : 'Send reset code'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/login" className="inline-flex items-center font-medium text-accent hover:underline">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
