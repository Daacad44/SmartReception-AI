import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function CheckEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';

  useEffect(() => {
    if (email) {
      navigate(`/verify-otp?email=${encodeURIComponent(email)}`, { replace: true });
    }
  }, [email, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      {!email && (
        <p className="ml-3 text-sm text-muted-foreground">
          <Link to="/register" className="text-accent hover:underline">
            Register
          </Link>{' '}
          to get started
        </p>
      )}
    </div>
  );
}
