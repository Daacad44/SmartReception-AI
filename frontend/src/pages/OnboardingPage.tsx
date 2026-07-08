import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2, FileText, Briefcase, Clock, Languages, Phone, PartyPopper,
  ChevronRight, ChevronLeft, Check, Loader2,
} from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LogoMark } from '@/components/Logo';
import { BusinessTypeCombobox } from '@/components/onboarding/BusinessTypeCombobox';
import type { BusinessTypeOption } from '@/lib/business-types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { isNetworkOrTimeoutError } from '@/lib/api';

const STEPS = [
  'Kusoo Dhawoow',
  'Macluumaadka Ganacsiga',
  'Sharaxaad',
  'Adeegyada',
  'Saacadaha Shaqada',
  'Luqadaha',
  'WhatsApp',
  'Dhamaad',
] as const;

const WEEKDAYS = ['Sabti', 'Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimco'] as const;

const SUGGESTED_SERVICES = [
  'AI Receptionist',
  'Website Development',
  'Mobile Apps',
  'CRM',
  'WhatsApp Automation',
  'AI Chatbot',
];

interface OnboardingStatusResponse {
  currentStep: number;
  totalSteps: number;
  hasBusiness: boolean;
  business?: {
    name: string;
    phone?: string;
    country?: string;
    city?: string;
    address?: string;
    website?: string;
    businessType?: string;
  };
  onboardingData?: {
    description?: string;
    services?: string[];
    workingHours?: Record<string, { open: string; close: string; closed?: boolean }>;
    languages?: string[];
  };
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  const [business, setBusiness] = useState({
    name: '', phone: '', country: 'Somalia', city: '', address: '', website: '',
    businessType: '', businessCategory: '', industry: 'OTHER',
  });
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessTypeOption | null>(null);
  const [description, setDescription] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [customService, setCustomService] = useState('');
  const [workingHours, setWorkingHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(
    Object.fromEntries(WEEKDAYS.map((d) => [d, { open: '08:00', close: '17:00', closed: d === 'Axad' }]))
  );
  const [languages, setLanguages] = useState({ so: true, en: true, ar: false });
  const [whatsapp, setWhatsapp] = useState({ wabaId: '', phoneNumberId: '', accessToken: '' });

  const { data: status, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => extractData<OnboardingStatusResponse>(await api.get('/onboarding/status')),
    retry: 2,
  });

  useEffect(() => {
    if (!status) return;
    setStep(status.currentStep);
    if (status.business) {
      setBusiness((prev) => ({
        ...prev,
        name: status.business!.name ?? prev.name,
        phone: status.business!.phone ?? prev.phone,
        country: status.business!.country ?? prev.country,
        city: status.business!.city ?? prev.city,
        address: status.business!.address ?? prev.address,
        website: status.business!.website ?? prev.website,
        businessType: status.business!.businessType ?? prev.businessType,
      }));
    }
    if (status.onboardingData?.description) setDescription(status.onboardingData.description);
    if (status.onboardingData?.services) setServices(status.onboardingData.services);
    if (status.onboardingData?.workingHours) setWorkingHours(status.onboardingData.workingHours as typeof workingHours);
    if (status.onboardingData?.languages) {
      setLanguages({
        so: status.onboardingData.languages.includes('so'),
        en: status.onboardingData.languages.includes('en'),
        ar: status.onboardingData.languages.includes('ar'),
      });
    }
  }, [status]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });

  const advanceWelcome = useMutation({
    mutationFn: async () => api.post('/onboarding/welcome'),
    onSuccess: () => { setStep(1); invalidate(); },
    onError: () => toast.error('Wax yar ayaa khaldamay. Fadlan mar kale isku day.'),
  });

  const saveBusiness = useMutation({
    mutationFn: async () =>
      api.post('/onboarding/business', {
        name: business.name,
        phone: business.phone,
        country: business.country,
        city: business.city,
        address: business.address,
        website: business.website,
        businessType: business.businessType,
        businessCategory: business.businessCategory,
        industry: business.industry,
      }),
    onSuccess: () => { setStep(2); invalidate(); },
    onError: () => toast.error('Kaydinta macluumaadka ganacsiga way fashilantay.'),
  });

  const saveDescription = useMutation({
    mutationFn: async () => api.patch('/onboarding/description', { description }),
    onSuccess: () => { setStep(3); invalidate(); },
    onError: () => toast.error('Kaydinta sharaxaadda way fashilantay.'),
  });

  const saveServices = useMutation({
    mutationFn: async () => api.patch('/onboarding/services', { services }),
    onSuccess: () => { setStep(4); invalidate(); },
    onError: () => toast.error('Kaydinta adeegyada way fashilantay.'),
  });

  const saveHours = useMutation({
    mutationFn: async () => api.patch('/onboarding/working-hours', { workingHours }),
    onSuccess: () => { setStep(5); invalidate(); },
    onError: () => toast.error('Kaydinta saacadaha shaqada way fashilantay.'),
  });

  const saveLanguages = useMutation({
    mutationFn: async () => {
      const selected = (['so', 'en', 'ar'] as const).filter((l) => languages[l]);
      return api.patch('/onboarding/languages', { languages: selected });
    },
    onSuccess: () => { setStep(6); invalidate(); },
    onError: () => toast.error('Kaydinta luqadaha way fashilantay.'),
  });

  const saveWhatsapp = useMutation({
    mutationFn: async (skip: boolean) =>
      api.post('/onboarding/whatsapp', skip ? { skipConnection: true } : { ...whatsapp, skipConnection: false }),
    onSuccess: () => { setStep(7); invalidate(); },
    onError: () => toast.error('WhatsApp waa la kaydiyay laakiin xiriirka wuu fashilmay.'),
  });

  const finish = useMutation({
    mutationFn: async () => api.post('/onboarding/complete'),
    onSuccess: () => {
      invalidate();
      toast.success('Hambalyo! Ganacsigaaga waa la diyaariyey.');
      navigate('/dashboard');
    },
    onError: (e) => toast.error(getErrorMessage(e) || 'Dhameystirka way fashilantay.'),
  });

  const isPending =
    advanceWelcome.isPending || saveBusiness.isPending || saveDescription.isPending ||
    saveServices.isPending || saveHours.isPending || saveLanguages.isPending ||
    saveWhatsapp.isPending || finish.isPending;

  const handleNext = () => {
    if (step === 0) advanceWelcome.mutate();
    else if (step === 1) saveBusiness.mutate();
    else if (step === 2) saveDescription.mutate();
    else if (step === 3) saveServices.mutate();
    else if (step === 4) saveHours.mutate();
    else if (step === 5) saveLanguages.mutate();
    else if (step === 6) saveWhatsapp.mutate(false);
    else if (step === 7) finish.mutate();
  };

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) return Boolean(business.name && business.phone && business.city && business.address);
    if (step === 2) return description.trim().length >= 10;
    if (step === 3) return services.length > 0;
    if (step === 4) return true;
    if (step === 5) return languages.so || languages.en || languages.ar;
    if (step === 6) return true;
    if (step === 7) return true;
    return false;
  };

  const toggleService = (service: string) => {
    setServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <LoadingState rows={3} />
        <p className="text-sm text-muted-foreground">Fadlan sug...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <ErrorState
          title="Wax yar ayaa khaldamay"
          message={
            isNetworkOrTimeoutError(error)
              ? 'Xiriirka server-ka ayaa cilad galay. Fadlan mar kale isku day.'
              : 'Fadlan mar kale isku day.'
          }
          retryLabel="Mar kale isku day"
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#090B14]">
              <LogoMark size={20} />
            </div>
            <span className="font-semibold">SomReception AI</span>
          </div>
          <span className="text-sm text-muted-foreground">Tallaabo {step + 1} / {STEPS.length}</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <Progress value={progress} className="mb-8 h-2" />

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 md:p-8">
            {step === 0 && (
              <div className="space-y-6 text-center">
                <PartyPopper className="mx-auto h-12 w-12 text-accent" />
                <h2 className="text-2xl font-bold">Kusoo Dhawoow SomReception AI</h2>
                <p className="text-muted-foreground">
                  Ku soo dhawoow SomReception AI. Waxaan kaa caawin doonaa inaad diyaariso ganacsigaaga
                  si AI Receptionist-ku u bilaabo shaqadiisa.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">Macluumaadka Ganacsiga</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Magaca Ganacsiga *</Label>
                    <Input value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nooca Ganacsiga</Label>
                    <BusinessTypeCombobox
                      value={selectedBusinessType?.id}
                      selectedType={selectedBusinessType}
                      onChange={(type) => {
                        setSelectedBusinessType(type);
                        setBusiness((prev) => ({
                          ...prev,
                          businessType: type.label,
                          businessCategory: type.category,
                          industry: type.industry,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Magaalada *</Label>
                    <Input value={business.city} onChange={(e) => setBusiness({ ...business, city: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dalka *</Label>
                    <Input value={business.country} onChange={(e) => setBusiness({ ...business, country: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Cinwaanka *</Label>
                    <Input value={business.address} onChange={(e) => setBusiness({ ...business, address: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefoon *</Label>
                    <Input value={business.phone} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Website (ikhtiyaari)</Label>
                    <Input value={business.website} onChange={(e) => setBusiness({ ...business, website: e.target.value })} placeholder="https://" />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">Sharaxaad Ganacsi</h2>
                </div>
                <p className="text-sm text-muted-foreground">Qor sharaxaad kooban oo ku saabsan ganacsigaaga.</p>
                <Textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Waxaan bixinaa adeegyo software development, AI automation, WhatsApp integration iyo CRM."
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">Adeegyada</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_SERVICES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleService(s)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        services.includes(s) ? 'border-accent bg-accent/10 text-accent' : 'hover:border-accent/50'
                      )}
                    >
                      {services.includes(s) && <Check className="mr-1 inline h-3 w-3" />}
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customService}
                    onChange={(e) => setCustomService(e.target.value)}
                    placeholder="Ku dar adeeg kale..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (customService.trim()) {
                        toggleService(customService.trim());
                        setCustomService('');
                      }
                    }}
                  >
                    Ku dar
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">Saacadaha Shaqada</h2>
                </div>
                {WEEKDAYS.map((day) => (
                  <div key={day} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                    <span className="w-20 text-sm font-medium">{day}</span>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border"
                        checked={workingHours[day]?.closed}
                        onChange={(e) =>
                          setWorkingHours((prev) => ({
                            ...prev,
                            [day]: { ...prev[day]!, closed: e.target.checked },
                          }))
                        }
                      />
                      Xiran
                    </label>
                    {!workingHours[day]?.closed && (
                      <>
                        <Input
                          type="time"
                          className="w-32"
                          value={workingHours[day]?.open ?? '08:00'}
                          onChange={(e) =>
                            setWorkingHours((prev) => ({
                              ...prev,
                              [day]: { ...prev[day]!, open: e.target.value },
                            }))
                          }
                        />
                        <span className="text-muted-foreground">—</span>
                        <Input
                          type="time"
                          className="w-32"
                          value={workingHours[day]?.close ?? '17:00'}
                          onChange={(e) =>
                            setWorkingHours((prev) => ({
                              ...prev,
                              [day]: { ...prev[day]!, close: e.target.value },
                            }))
                          }
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <Languages className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">Luqadaha</h2>
                </div>
                {[
                  { key: 'so' as const, label: 'Soomaali' },
                  { key: 'en' as const, label: 'English' },
                  { key: 'ar' as const, label: 'Arabic' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 rounded-lg border p-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border"
                      checked={languages[key]}
                      onChange={(e) => setLanguages((prev) => ({ ...prev, [key]: e.target.checked }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <Phone className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">WhatsApp</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ma rabtaa hadda inaad ku xirto WhatsApp Business?
                </p>
                <div className="grid gap-4">
                  <Input placeholder="WABA ID" value={whatsapp.wabaId} onChange={(e) => setWhatsapp({ ...whatsapp, wabaId: e.target.value })} />
                  <Input placeholder="Phone Number ID" value={whatsapp.phoneNumberId} onChange={(e) => setWhatsapp({ ...whatsapp, phoneNumberId: e.target.value })} />
                  <Input type="password" placeholder="Access Token" value={whatsapp.accessToken} onChange={(e) => setWhatsapp({ ...whatsapp, accessToken: e.target.value })} />
                </div>
                <Button variant="outline" onClick={() => saveWhatsapp.mutate(true)} disabled={isPending}>
                  Marka Dambe
                </Button>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-6 text-center">
                <Check className="mx-auto h-12 w-12 text-success" />
                <h2 className="text-2xl font-bold">Hambalyo!</h2>
                <p className="text-muted-foreground">
                  Ganacsigaaga waa la diyaariyey. Waxaad hadda geli kartaa Dashboard-ka.
                </p>
              </div>
            )}

            <div className="mt-8 flex justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || isPending}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />Dib u noqo
              </Button>
              <Button
                className="bg-accent hover:bg-accent/90"
                onClick={handleNext}
                disabled={!canProceed() || isPending}
              >
                {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {isPending
                  ? 'Fadlan sug...'
                  : step === 0
                    ? 'Sii Wad'
                    : step === 1
                      ? 'Keydi oo Sii Wad'
                      : step === 7
                        ? 'Tag Dashboard'
                        : 'Sii Wad'}
                {step < 7 && !isPending && <ChevronRight className="ml-1 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
