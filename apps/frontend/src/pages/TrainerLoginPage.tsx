import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const TRAINER_TOKEN_KEY = 'trainer_access_token';
const TRAINER_BUSINESS_KEY = 'trainer_business_id';

export function getTrainerToken(): string | null {
  return localStorage.getItem(TRAINER_TOKEN_KEY);
}

export function setTrainerSession(token: string, businessId?: string) {
  localStorage.setItem(TRAINER_TOKEN_KEY, token);
  if (businessId) localStorage.setItem(TRAINER_BUSINESS_KEY, businessId);
}

export function clearTrainerSession() {
  localStorage.removeItem(TRAINER_TOKEN_KEY);
  localStorage.removeItem(TRAINER_BUSINESS_KEY);
}

export function TrainerLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/trainer-portal/login', { username, password });
      const data = extractData<{
        accessToken: string;
        trainer: { businesses: Array<{ id: string }> };
      }>(response);
      const businessId = data.trainer.businesses[0]?.id;
      setTrainerSession(data.accessToken, businessId);
      toast.success('Welcome to the AI Trainer Portal');
      navigate('/trainer');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Brain className="mx-auto h-10 w-10 text-accent" />
          <CardTitle>AI Trainer Portal</CardTitle>
          <CardDescription>Sign in to train and validate business AI models</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
