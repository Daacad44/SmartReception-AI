import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Brain, LogOut, Building2 } from 'lucide-react';
import axios from 'axios';
import { clearTrainerSession, getTrainerToken } from '@/pages/TrainerLoginPage';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TRAINER_BUSINESS_KEY = 'trainer_business_id';

export function TrainerProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getTrainerToken()) {
    return <Navigate to="/trainer/login" replace />;
  }
  return <>{children}</>;
}

export function TrainerLayout() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [businessId, setBusinessId] = useState(localStorage.getItem(TRAINER_BUSINESS_KEY) ?? '');

  useEffect(() => {
    const token = getTrainerToken();
    if (!token) return;

    const client = axios.create({
      baseURL: import.meta.env.VITE_API_URL ?? '/api',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(businessId ? { 'X-Business-Id': businessId } : {}),
      },
    });

    client
      .get('/trainer-portal/businesses')
      .then((res) => {
        const list = res.data.data as Array<{ id: string; name: string }>;
        setBusinesses(list);
        if (!businessId && list[0]) {
          setBusinessId(list[0].id);
          localStorage.setItem(TRAINER_BUSINESS_KEY, list[0].id);
        }
      })
      .catch(() => undefined);
  }, [businessId]);

  const handleLogout = () => {
    clearTrainerSession();
    navigate('/trainer/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-accent" />
            <span className="font-semibold">AI Trainer Portal</span>
          </div>
          <nav className="hidden items-center gap-4 text-sm md:flex">
            <Link to="/trainer" className="text-muted-foreground hover:text-foreground">
              AI Training
            </Link>
            <Link to="/trainer/jobs" className="text-muted-foreground hover:text-foreground">
              Training Jobs
            </Link>
            <Link to="/trainer/sandbox" className="text-muted-foreground hover:text-foreground">
              Sandbox
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {businesses.length > 0 && (
              <Select
                value={businessId}
                onValueChange={(value) => {
                  setBusinessId(value);
                  localStorage.setItem(TRAINER_BUSINESS_KEY, value);
                  window.location.reload();
                }}
              >
                <SelectTrigger className="w-48">
                  <Building2 className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Select business" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet context={{ businessId, token: getTrainerToken() }} />
      </main>
    </div>
  );
}
