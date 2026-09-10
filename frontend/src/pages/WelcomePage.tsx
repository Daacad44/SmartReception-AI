import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, Users, BookOpen, Phone, Megaphone, Sparkles, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BrandLogo } from '@/components/Logo';
import { BRAND_NAME } from '@/lib/brand';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const CHECKLIST = [
  { icon: Users, label: 'Upload Customers', path: '/customers/import', desc: 'Import your customer database' },
  { icon: BookOpen, label: 'Upload Knowledge Base', path: '/knowledge', desc: 'Train your AI receptionist' },
  { icon: Phone, label: 'Connect WhatsApp', path: '/settings', desc: 'Link your business number' },
  { icon: Megaphone, label: 'Create First Campaign', path: '/campaigns', desc: 'Send your first broadcast' },
  { icon: Sparkles, label: 'Configure AI Receptionist', path: '/settings', desc: 'Customize AI responses' },
];

export function WelcomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const markSeen = useMutation({
    mutationFn: async () => api.post('/onboarding/welcome-seen'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      navigate('/dashboard');
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-[#090B14] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center">
          <BrandLogo variant="full" className="h-10 w-auto max-w-[220px]" />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-3xl font-bold">Welcome to {BRAND_NAME}</h1>
          <p className="mt-2 text-muted-foreground">Your workspace is ready. Here&apos;s how to get started.</p>
        </div>

        <Card className="mb-8 border-0 shadow-lg">
          <CardContent className="p-6">
            <h2 className="mb-4 font-semibold">Setup Checklist</h2>
            <div className="space-y-3">
              {CHECKLIST.map((item, i) => (
                <Link
                  key={item.label}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/5'
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <item.icon className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{i + 1}. {item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            className="bg-accent hover:bg-accent/90"
            size="lg"
            onClick={() => markSeen.mutate()}
            disabled={markSeen.isPending}
          >
            Go to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
