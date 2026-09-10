import { Link } from 'react-router-dom';
import { BrandLogo, BrandTagline } from '@/components/Logo';
import { BRAND_NAME } from '@/lib/brand';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#090B14] px-6 py-16 text-center">
      <BrandLogo variant="full" className="mb-10 h-14 w-auto max-w-[280px]" />
      <p className="mb-3 text-sm font-semibold tracking-[0.2em] text-[#F59E0B]">404</p>
      <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white">Page not found</h1>
      <p className="mb-8 max-w-md text-sm leading-relaxed text-slate-400">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="bg-[#F59E0B] text-[#0D1B4B] hover:bg-[#F59E0B]/90">
          <Link to="/">Back to {BRAND_NAME}</Link>
        </Button>
        <Button asChild variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
      <BrandTagline onDark as="p" className="mt-12 text-xs" />
    </div>
  );
}
