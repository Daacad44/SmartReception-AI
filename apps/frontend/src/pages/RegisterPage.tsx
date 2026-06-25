import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Bot, Mail, Lock, User, ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import api, { extractData } from '@/lib/api';
import { cn } from '@/lib/utils';

const passwordChecks = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Full name is required'),
    email: z.string().email('Please enter a valid business email'),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, 'Include uppercase')
      .regex(/[a-z]/, 'Include lowercase')
      .regex(/[0-9]/, 'Include number')
      .regex(/[^A-Za-z0-9]/, 'Include special character'),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { register: registerUser, isRegistering } = useAuth();
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  });

  const password = watch('password') ?? '';
  const email = watch('email') ?? '';

  useEffect(() => {
    if (!email || !z.string().email().safeParse(email).success) {
      setEmailStatus('idle');
      return;
    }
    const timer = setTimeout(async () => {
      setEmailStatus('checking');
      try {
        const result = extractData<{ available: boolean }>(
          await api.get('/auth/check-email', { params: { email } })
        );
        setEmailStatus(result.available ? 'available' : 'taken');
      } catch {
        setEmailStatus('idle');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [email]);

  const onSubmit = (data: RegisterForm) => {
    const parts = data.fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? '';
    const lastName = parts.slice(1).join(' ') || firstName;
    registerUser({
      firstName,
      lastName,
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
    });
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
            <Bot className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold">SmartReception AI</span>
        </div>
        <div>
          <h2 className="mb-4 text-4xl font-bold leading-tight">
            Professional WhatsApp<br />automation for your business
          </h2>
          <p className="text-lg text-white/70">
            Join businesses using AI receptionists, campaign automation, and CRM — all in one platform.
          </p>
        </div>
        <p className="text-sm text-white/40">© 2025 SmartReception AI. All rights reserved.</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 md:p-8">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>Start your SmartReception AI journey</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="John Smith" {...register('fullName')} />
                </div>
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Business Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="email" className="pl-9 pr-9" placeholder="you@company.com" {...register('email')} />
                  {emailStatus === 'available' && (
                    <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
                  )}
                  {emailStatus === 'taken' && (
                    <X className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
                  )}
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                {emailStatus === 'taken' && (
                  <p className="text-xs text-destructive">This email is already registered</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" className="pl-9" {...register('password')} />
                </div>
                {password && (
                  <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {passwordChecks.map((check) => (
                      <li
                        key={check.id}
                        className={cn(
                          'flex items-center gap-1.5 text-xs',
                          check.test(password) ? 'text-success' : 'text-muted-foreground'
                        )}
                      >
                        {check.test(password) ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border" />}
                        {check.label}
                      </li>
                    ))}
                  </ul>
                )}
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" className="pl-9" {...register('confirmPassword')} />
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90"
                disabled={isRegistering || emailStatus === 'taken'}
              >
                {isRegistering ? 'Creating account...' : 'Create account'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-accent hover:underline">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
