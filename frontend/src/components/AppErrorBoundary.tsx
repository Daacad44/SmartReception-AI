import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence around the whole app.
 *
 * React unmounts the entire tree when a render or effect throws without a
 * boundary above it, which leaves nothing but the page background — a blank
 * screen the user cannot recover from and that reports nothing. This keeps the
 * failure visible and offers a way out, including a hard reset for the case
 * where a stale service worker or cache is the thing doing the breaking.
 *
 * Styled with inline styles on purpose: it must still render if the crash came
 * from the theme, the router or the stylesheet.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = async () => {
    try {
      if (navigator.serviceWorker) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* best effort — reload regardless */
    }
    window.location.replace('/');
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          padding: '32px 24px',
          background: '#090b14',
          color: '#e5e7eb',
          font: '400 15px/1.6 system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}
      >
        <img src="/brand/somreception-icon.png" alt="" width={64} height={64} />
        <h1 style={{ margin: 0, font: '700 20px/1.3 system-ui, sans-serif' }}>
          Something went wrong
        </h1>
        <p style={{ margin: 0, maxWidth: '26rem', color: '#9ca3af' }}>
          SomReception AI hit an unexpected error and had to stop. Reloading usually fixes it.
        </p>
        <code
          style={{
            maxWidth: '30rem',
            overflowWrap: 'anywhere',
            borderRadius: 8,
            background: '#111827',
            padding: '10px 12px',
            font: '400 12px/1.5 ui-monospace, monospace',
            color: '#fca5a5',
          }}
        >
          {error.message || String(error)}
        </code>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              border: 0,
              borderRadius: 9999,
              background: '#f59e0b',
              padding: '10px 22px',
              font: '600 14px system-ui, sans-serif',
              color: '#0b0b0b',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              borderRadius: 9999,
              border: '1px solid #374151',
              background: 'transparent',
              padding: '10px 22px',
              font: '600 14px system-ui, sans-serif',
              color: '#e5e7eb',
              cursor: 'pointer',
            }}
          >
            Clear cache and sign out
          </button>
        </div>
      </div>
    );
  }
}
