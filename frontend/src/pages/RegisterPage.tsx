import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Bot, Mail, Lock, User, ArrowRight, Check, X, Building2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import api, { extractData } from '@/lib/api';
import { cn } from '@/lib/utils';

const passwordChecks = [
  { id: 'length', label: 'Ugu yaraan 8 xaraf', test: (p: string) => p.length >= 8 },
  { id: 'upper', label: 'Hal xaraf weyn', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Hal xaraf yar', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'Hal lambar', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'Hal calaamad gaar ah', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

const registerSchema = z
  .object({
    businessName: z.string().min(2, 'Magaca ganacsiga waa waajib'),
    fullName: z.string().min(2, 'Magaca mulkiilaha waa waajib'),
    phone: z.string().min(6, 'Telefoon sax ah geli'),
    email: z.string().email('Email sax ah geli'),
    password: z
      .string()
      .min(8, 'Password waa inuu ka koobnaadaa ugu yaraan 8 xaraf')
      .regex(/[A-Z]/, 'Ku dar xaraf weyn')
      .regex(/[a-z]/, 'Ku dar xaraf yar')
      .regex(/[0-9]/, 'Ku dar lambar')
      .regex(/[^A-Za-z0-9]/, 'Ku dar calaamad gaar ah'),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Password-yadu isma laha',
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
      businessName: data.businessName,
      phone: data.phone,
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
            Isdiiwaangeli<br />ganacsigaaga
          </h2>
          <p className="text-lg text-white/70">
            Abuur AI Receptionist, WhatsApp automation, iyo CRM — dhammaan hal madal.
          </p>
        </div>
        <p className="text-sm text-white/40">© 2025 SmartReception AI</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 md:p-8">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Abuur Akoon</CardTitle>
            <CardDescription>Bilow safarkaaga SmartReception AI</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Magaca Ganacsiga *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Tusaale: SmartReception AI" {...register('businessName')} />
                </div>
                {errors.businessName && <p className="text-xs text-destructive">{errors.businessName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Magaca Mulkiilaha *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Magacaaga oo buuxa" {...register('fullName')} />
                </div>
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Telefoon *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="+252..." {...register('phone')} />
                </div>
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="email" className="pl-9 pr-9" placeholder="email@ganacsiga.com" {...register('email')} />
                  {emailStatus === 'available' && (
                    <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
                  )}
                  {emailStatus === 'taken' && (
                    <X className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
                  )}
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                {emailStatus === 'taken' && (
                  <p className="text-xs text-destructive">Email-kan hore ayaa loo diiwaangeliyay</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Password *</Label>
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
                <Label>Xaqiiji Password *</Label>
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
                {isRegistering ? 'Fadlan sug...' : 'Abuur Akoon'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Hore ma u lahayd akoon?{' '}
              <Link to="/login" className="font-medium text-accent hover:underline">Gal</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
