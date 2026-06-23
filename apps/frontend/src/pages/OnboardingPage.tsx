import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Building2, Users, MessageSquare, CreditCard, Phone,
  ChevronRight, ChevronLeft, Check, Loader2, ExternalLink,
} from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BusinessTypeCombobox } from '@/components/onboarding/BusinessTypeCombobox';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STEPS = ['Business Info', 'Profile', 'Discovery', 'Plan', 'WhatsApp'] as const;

const PLANS = [
  {
    id: 'FREE',
    name: 'Free Trial',
    price: '$0',
    desc: 'Limited customers, conversations & storage',
    features: ['50 customers', '100 conversations/mo', '1 team member', 'Basic AI'],
  },
  {
    id: 'STARTER',
    name: 'Starter',
    price: '$29',
    desc: 'For small businesses',
    features: ['500 customers', '1,000 conversations/mo', '3 team members', 'WhatsApp automation'],
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    price: '$99',
    desc: 'For growing businesses',
    features: ['2,000 customers', '5,000 conversations/mo', '10 team members', 'Campaigns & CRM'],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: '$299',
    desc: 'For large organizations',
    features: ['20,000 customers', '50,000 conversations/mo', '100 team members', 'Priority support'],
  },
] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const login = useAuthStore((s) => s.login);
  const [step, setStep] = useState(0);

  const [business, setBusiness] = useState({
    name: '', industry: '', businessType: '', businessTypeId: '',
    phone: '', whatsappNumber: '', country: '', city: '', address: '', website: '',
  });
  const [profile, setProfile] = useState({
    employeeRange: '', customerVolume: '', mainGoal: '',
  });
  const [discovery, setDiscovery] = useState({
    referralSource: '', problemToSolve: '', biggestChallenge: '',
  });
  const [selectedPlan, setSelectedPlan] = useState('FREE');
  const [whatsapp, setWhatsapp] = useState({
    wabaId: '', phoneNumberId: '', accessToken: '', skipConnection: false,
  });
  const [testing, setTesting] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const saveBusiness = useMutation({
    mutationFn: async () => {
      const { businessTypeId: _id, ...payload } = business;
      const response = await api.post('/onboarding/business', payload);
      return extractData<{
        business: { id: string; name: string };
        tokens: { accessToken: string; refreshToken: string } | null;
      }>(response);
    },
    onSuccess: (data) => {
      if (data.tokens) {
        const current = useAuthStore.getState().user;
        if (current) {
          login(data.tokens.accessToken, data.tokens.refreshToken, {
            ...current,
            role: 'OWNER',
            businesses: [{ id: data.business.id, name: data.business.name, industry: business.industry, plan: 'FREE', role: 'OWNER' }],
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      setStep(1);
    },
    onError: () => toast.error('Failed to save business information'),
  });

  const saveProfile = useMutation({
    mutationFn: async () => api.patch('/onboarding/profile', profile),
    onSuccess: () => { setStep(2); queryClient.invalidateQueries({ queryKey: ['onboarding-status'] }); },
    onError: () => toast.error('Failed to save profile'),
  });

  const saveDiscovery = useMutation({
    mutationFn: async () => api.patch('/onboarding/discovery', discovery),
    onSuccess: () => { setStep(3); queryClient.invalidateQueries({ queryKey: ['onboarding-status'] }); },
    onError: () => toast.error('Failed to save responses'),
  });

  const savePlan = useMutation({
    mutationFn: async () => api.post('/onboarding/plan', { plan: selectedPlan }),
    onSuccess: () => { setStep(4); queryClient.invalidateQueries({ queryKey: ['onboarding-status'] }); },
    onError: () => toast.error('Failed to select plan'),
  });

  const saveWhatsapp = useMutation({
    mutationFn: async () => api.post('/onboarding/whatsapp', whatsapp),
    onSuccess: async () => {
      await api.post('/onboarding/complete');
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      toast.success('Workspace created successfully!');
      navigate('/welcome');
    },
    onError: () => toast.error('Failed to complete setup. Check credentials or skip for now.'),
  });

  const testWhatsapp = useCallback(async () => {
    setTesting(true);
    try {
      await api.post('/onboarding/whatsapp', { ...whatsapp, skipConnection: false });
      await api.post('/whatsapp/test');
      toast.success('Connection successful!');
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  }, [whatsapp]);

  const progress = ((step + 1) / STEPS.length) * 100;
  const isPending = saveBusiness.isPending || saveProfile.isPending || saveDiscovery.isPending || savePlan.isPending || saveWhatsapp.isPending;

  const handleNext = () => {
    if (step === 0) saveBusiness.mutate();
    else if (step === 1) saveProfile.mutate();
    else if (step === 2) saveDiscovery.mutate();
    else if (step === 3) savePlan.mutate();
    else if (step === 4) saveWhatsapp.mutate();
  };

  const canProceed = () => {
    if (step === 0) return business.name && business.industry && business.businessType && business.phone && business.whatsappNumber && business.country && business.city && business.address;
    if (step === 1) return profile.employeeRange && profile.customerVolume && profile.mainGoal;
    if (step === 2) return discovery.referralSource && discovery.problemToSolve.length >= 10 && discovery.biggestChallenge.length >= 10;
    if (step === 3) return Boolean(selectedPlan);
    if (step === 4) return whatsapp.skipConnection || (whatsapp.wabaId && whatsapp.phoneNumberId && whatsapp.accessToken);
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="relative z-10 border-b bg-card px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">SmartReception AI</span>
          </div>
          <span className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap gap-2">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                  i === step ? 'bg-accent text-accent-foreground' : i < step ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 md:p-8">
            {step === 0 && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">Business Information</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Business Name *</Label>
                    <Input value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Business Type *</Label>
                    <BusinessTypeCombobox
                      value={business.businessTypeId}
                      onChange={(type) =>
                        setBusiness((prev) => ({
                          ...prev,
                          businessTypeId: type.id,
                          businessType: type.label,
                          industry: type.industry,
                        }))
                      }
                      onAfterSelect={() => phoneInputRef.current?.focus()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Phone *</Label>
                    <Input ref={phoneInputRef} value={business.phone} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp Number *</Label>
                    <Input value={business.whatsappNumber} onChange={(e) => setBusiness({ ...business, whatsappNumber: e.target.value })} placeholder="+1234567890" />
                  </div>
                  <div className="space-y-2">
                    <Label>Country *</Label>
                    <Input value={business.country} onChange={(e) => setBusiness({ ...business, country: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>City *</Label>
                    <Input value={business.city} onChange={(e) => setBusiness({ ...business, city: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Business Address *</Label>
                    <Input value={business.address} onChange={(e) => setBusiness({ ...business, address: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Website (optional)</Label>
                    <Input value={business.website} onChange={(e) => setBusiness({ ...business, website: e.target.value })} placeholder="https://" />
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">Business Profile</h2>
                </div>
                {[
                  { key: 'employeeRange', label: 'Number of Employees', options: ['1-5', '5-20', '20-50', '50-100', '100+'] },
                  { key: 'customerVolume', label: 'Customer Volume', options: ['1-50', '50-200', '200-1000', '1000+'] },
                ].map(({ key, label, options }) => (
                  <div key={key} className="space-y-2">
                    <Label>{label} *</Label>
                    <Select value={profile[key as keyof typeof profile]} onValueChange={(v) => setProfile({ ...profile, [key]: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="space-y-2">
                  <Label>Main Goal *</Label>
                  <Select value={profile.mainGoal} onValueChange={(v) => setProfile({ ...profile, mainGoal: v })}>
                    <SelectTrigger><SelectValue placeholder="What do you want to achieve?" /></SelectTrigger>
                    <SelectContent>
                      {[
                        ['AI_RECEPTIONIST', 'AI Receptionist'],
                        ['WHATSAPP_AUTOMATION', 'WhatsApp Automation'],
                        ['APPOINTMENT_BOOKING', 'Appointment Booking'],
                        ['CRM', 'CRM'],
                        ['MARKETING_CAMPAIGNS', 'Marketing Campaigns'],
                        ['CUSTOMER_SUPPORT', 'Customer Support'],
                        ['LEAD_GENERATION', 'Lead Generation'],
                      ].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">Tell us about yourself</h2>
                </div>
                <div className="space-y-2">
                  <Label>How did you hear about SmartReception? *</Label>
                  <Select value={discovery.referralSource} onValueChange={(v) => setDiscovery({ ...discovery, referralSource: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {['FACEBOOK', 'TIKTOK', 'GOOGLE', 'WHATSAPP', 'YOUTUBE', 'FRIEND_REFERRAL', 'EXISTING_CUSTOMER', 'OTHER'].map((s) => (
                        <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>What problem are you trying to solve? *</Label>
                  <Textarea rows={3} value={discovery.problemToSolve} onChange={(e) => setDiscovery({ ...discovery, problemToSolve: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>What is your biggest business challenge? *</Label>
                  <Textarea rows={3} value={discovery.biggestChallenge} onChange={(e) => setDiscovery({ ...discovery, biggestChallenge: e.target.value })} />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">Choose Your Plan</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={cn(
                        'rounded-xl border p-4 text-left transition-all',
                        selectedPlan === plan.id ? 'border-accent bg-accent/5 ring-2 ring-accent' : 'hover:border-accent/50'
                      )}
                    >
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="font-semibold">{plan.name}</span>
                        <span className="text-lg font-bold text-accent">{plan.price}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                      </div>
                      <p className="mb-3 text-xs text-muted-foreground">{plan.desc}</p>
                      <ul className="space-y-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-1.5 text-xs">
                            <Check className="h-3 w-3 text-success" />{f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <Phone className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">Connect WhatsApp Business</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your Meta WhatsApp Cloud API to send and receive messages using your business number.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer">
                      Setup Guide <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>WhatsApp Business Account ID *</Label>
                    <Input value={whatsapp.wabaId} onChange={(e) => setWhatsapp({ ...whatsapp, wabaId: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number ID *</Label>
                    <Input value={whatsapp.phoneNumberId} onChange={(e) => setWhatsapp({ ...whatsapp, phoneNumberId: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Permanent Access Token *</Label>
                    <Input type="password" value={whatsapp.accessToken} onChange={(e) => setWhatsapp({ ...whatsapp, accessToken: e.target.value })} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={testWhatsapp} disabled={testing || whatsapp.skipConnection}>
                    {testing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                    Test Connection
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setWhatsapp({ ...whatsapp, skipConnection: true })}>
                    Skip for now
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-between gap-3">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || isPending}>
                <ChevronLeft className="mr-1 h-4 w-4" />Back
              </Button>
              <Button className="bg-accent hover:bg-accent/90" onClick={handleNext} disabled={!canProceed() || isPending}>
                {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                {step === STEPS.length - 1 ? 'Create Workspace' : 'Continue'}
                {step < STEPS.length - 1 && <ChevronRight className="ml-1 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
