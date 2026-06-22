import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Bot, Bell, Shield, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useBusinessSettings, useAiConfig } from '@/hooks/useApi';
import { useUpdateBusinessSettings, useUpdateAiConfig } from '@/hooks/useMutations';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { WhatsAppSettings } from '@/components/settings/WhatsAppSettings';
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings';
import { usePermissions } from '@/hooks/usePermissions';

const businessSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  timezone: z.string(),
});

const aiSchema = z.object({
  greetingMessage: z.string().min(1),
  fallbackMessage: z.string().optional(),
  enableAutoReply: z.boolean(),
  enableBooking: z.boolean(),
  enableLeadQualification: z.boolean(),
  language: z.string(),
});

type BusinessForm = z.infer<typeof businessSchema>;
type AiForm = z.infer<typeof aiSchema>;

export function SettingsPage() {
  const { data: settings, isLoading: settingsLoading, isError: settingsError } = useBusinessSettings();
  const { data: aiConfig, isLoading: aiLoading } = useAiConfig();
  const updateSettings = useUpdateBusinessSettings();
  const updateAiConfig = useUpdateAiConfig();
  const { hasPermission } = usePermissions();

  const businessForm = useForm<BusinessForm>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: '',
      timezone: 'America/New_York',
    },
  });

  const aiForm = useForm<AiForm>({
    resolver: zodResolver(aiSchema),
    defaultValues: {
      greetingMessage: 'Hello! How can I help you today?',
      fallbackMessage: '',
      enableAutoReply: true,
      enableBooking: true,
      enableLeadQualification: true,
      language: 'en',
    },
  });

  useEffect(() => {
    if (settings) {
      businessForm.reset({
        name: settings.name,
        phone: settings.phone ?? '',
        email: settings.email ?? '',
        address: settings.address ?? '',
        timezone: settings.timezone,
      });
    }
  }, [settings, businessForm]);

  useEffect(() => {
    if (aiConfig) {
      aiForm.reset({
        greetingMessage: aiConfig.greetingMessage ?? 'Hello! How can I help you today?',
        fallbackMessage: aiConfig.fallbackMessage ?? '',
        enableAutoReply: aiConfig.enableAutoReply,
        enableBooking: aiConfig.enableBooking,
        enableLeadQualification: aiConfig.enableLeadQualification,
        language: aiConfig.languages[0] ?? 'en',
      });
    }
  }, [aiConfig, aiForm]);

  const onSaveBusiness = businessForm.handleSubmit(async (data) => {
    await updateSettings.mutateAsync({
      name: data.name,
      timezone: data.timezone,
      phone: data.phone,
      email: data.email || undefined,
      address: data.address,
    });
  });

  const onSaveAi = aiForm.handleSubmit(async (data) => {
    await updateAiConfig.mutateAsync({
      greetingMessage: data.greetingMessage,
      fallbackMessage: data.fallbackMessage,
      enableAutoReply: data.enableAutoReply,
      enableBooking: data.enableBooking,
      enableLeadQualification: data.enableLeadQualification,
      languages: [data.language],
    });
  });

  if (settingsError) {
    return <ErrorState message="Unable to load settings." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your business and platform preferences</p>
      </div>

      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4" />
            Business
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="h-4 w-4" />
            AI Assistant
          </TabsTrigger>
          {hasPermission('settings:write') && (
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
          )}
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>Update your business profile and contact details</CardDescription>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <LoadingState rows={4} />
              ) : (
                <form onSubmit={onSaveBusiness} className="space-y-4 max-w-lg">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input {...businessForm.register('name')} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input {...businessForm.register('phone')} placeholder="+1 555-0100" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input {...businessForm.register('email')} placeholder="contact@business.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea {...businessForm.register('address')} placeholder="123 Main St, City, State" />
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={businessForm.watch('timezone')}
                      onValueChange={(v) => businessForm.setValue('timezone', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="Europe/London">GMT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    className="bg-accent hover:bg-accent/90"
                    disabled={updateSettings.isPending}
                  >
                    Save Changes
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Assistant Configuration</CardTitle>
              <CardDescription>Customize how your AI assistant interacts with customers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-lg">
              {aiLoading ? (
                <LoadingState rows={4} />
              ) : (
                <form onSubmit={onSaveAi} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Greeting Message</Label>
                    <Textarea {...aiForm.register('greetingMessage')} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fallback Message</Label>
                    <Textarea {...aiForm.register('fallbackMessage')} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Primary Language</Label>
                    <Select
                      value={aiForm.watch('language')}
                      onValueChange={(v) => aiForm.setValue('language', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="pt">Portuguese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Auto-reply to messages</p>
                      <p className="text-xs text-muted-foreground">AI responds automatically to incoming messages</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => aiForm.setValue('enableAutoReply', !aiForm.watch('enableAutoReply'))}
                    >
                      {aiForm.watch('enableAutoReply') ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Appointment booking</p>
                      <p className="text-xs text-muted-foreground">Allow AI to schedule appointments</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => aiForm.setValue('enableBooking', !aiForm.watch('enableBooking'))}
                    >
                      {aiForm.watch('enableBooking') ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                  <Button
                    type="submit"
                    className="bg-accent hover:bg-accent/90"
                    disabled={updateAiConfig.isPending}
                  >
                    Save AI Settings
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {hasPermission('settings:write') && (
          <TabsContent value="whatsapp" className="mt-6">
            <WhatsAppSettings />
          </TabsContent>
        )}

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Real-time notifications appear in the top bar</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Email notification preferences will be available in a future release.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-4">
          <TwoFactorSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
