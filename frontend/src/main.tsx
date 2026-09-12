import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);

// Reaching this point means the shell and entry bundle are in sync, so the
// boot watchdog in index.html can forget any earlier recovery attempt.
try {
  sessionStorage.removeItem('sr-shell-recovery');
} catch {
  /* storage unavailable */
}
