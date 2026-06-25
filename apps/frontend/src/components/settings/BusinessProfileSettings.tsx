import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Loader2, RefreshCw } from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/LoadingState';
import { toast } from 'sonner';

interface BusinessProfile {
  id: string;
  businessName?: string;
  companyOverview?: string;
  aboutUs?: string;
  mission?: string;
  vision?: string;
  businessDescription?: string;
  website?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  country?: string;
  workingHours?: string;
  whyChooseUs?: string;
  companyIntroduction?: string;
  shortIntroduction?: string;
  longIntroduction?: string;
  callToAction?: string;
  brandTone?: string;
  profilePdfFilename?: string;
  extractionStatus?: string;
}

export function BusinessProfileSettings() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Partial<BusinessProfile>>({});

  const { data: profile, isLoading } = useQuery({
    queryKey: ['business-profile'],
    queryFn: async () => {
      const data = await extractData<BusinessProfile>(await api.get('/business-profile'));
      setForm(data);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<BusinessProfile>) =>
      api.patch('/business-profile', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-profile'] });
      toast.success('Business Profile saved');
    },
    onError: () => toast.error('Failed to save Business Profile'),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return api.post('/business-profile/upload-pdf', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-profile'] });
      toast.success('Business Profile PDF uploaded — extracting company information');
    },
    onError: () => toast.error('PDF upload failed'),
  });

  const reprocessMutation = useMutation({
    mutationFn: async () => api.post('/business-profile/reprocess-pdf'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-profile'] });
      toast.success('Re-processing PDF');
    },
  });

  const set = (key: keyof BusinessProfile, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (isLoading) return <LoadingState rows={6} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Business Profile PDF</CardTitle>
          <CardDescription>
            Upload one PDF named &quot;Business Profile&quot;. AI extracts company identity only —
            separate from your Knowledge Base documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              {uploadMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload Business Profile PDF
            </Button>
            {profile?.profilePdfFilename && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => reprocessMutation.mutate()}
                disabled={reprocessMutation.isPending}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Re-extract
              </Button>
            )}
          </div>
          {profile?.profilePdfFilename && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              {profile.profilePdfFilename}
              {profile.extractionStatus && ` · ${profile.extractionStatus}`}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Identity</CardTitle>
          <CardDescription>
            Used when customers ask who you are, about your company, contact details, or on the first
            message. Never mixed with Knowledge Base.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={form.businessName ?? ''} onChange={(e) => set('businessName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Brand Tone</Label>
              <Input value={form.brandTone ?? ''} onChange={(e) => set('brandTone', e.target.value)} placeholder="Professional, friendly" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Short Introduction</Label>
            <Textarea rows={3} value={form.shortIntroduction ?? ''} onChange={(e) => set('shortIntroduction', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Long Introduction</Label>
            <Textarea rows={4} value={form.longIntroduction ?? ''} onChange={(e) => set('longIntroduction', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Mission</Label>
              <Textarea rows={2} value={form.mission ?? ''} onChange={(e) => set('mission', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vision</Label>
              <Textarea rows={2} value={form.vision ?? ''} onChange={(e) => set('vision', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Why Choose Us</Label>
            <Textarea rows={3} value={form.whyChooseUs ?? ''} onChange={(e) => set('whyChooseUs', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Working Hours</Label>
            <Input value={form.workingHours ?? ''} onChange={(e) => set('workingHours', e.target.value)} placeholder="Mon–Fri 9AM–6PM" />
          </div>
          <div className="space-y-2">
            <Label>Call To Action</Label>
            <Input value={form.callToAction ?? ''} onChange={(e) => set('callToAction', e.target.value)} placeholder="How can we help you today?" />
          </div>
          <Button
            className="bg-accent hover:bg-accent/90"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            Save Business Profile
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
