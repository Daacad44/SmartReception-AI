import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** The `beforeinstallprompt` event (not yet in the standard lib DOM types). */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

interface PwaInstallContextValue {
  /** True when the browser has fired a usable install prompt (Chromium/Edge/Android). */
  canPrompt: boolean;
  /** True once the app is running as an installed standalone app. */
  isInstalled: boolean;
  /** iOS Safari never fires beforeinstallprompt — we show manual instructions instead. */
  isIOS: boolean;
  /** True on any platform where the user can install (native prompt OR iOS manual). */
  isInstallable: boolean;
  /** Fire the native prompt. Returns the user's choice. */
  promptInstall: () => Promise<InstallOutcome>;
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayModes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
  const matchesDisplayMode = displayModes.some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches
  );
  // iOS Safari exposes navigator.standalone.
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return matchesDisplayMode || iosStandalone;
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isiOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac but is touch-capable.
  const isiPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return (isiOSDevice || isiPadOS) && isSafari;
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(detectStandalone);
  const isIOS = useMemo(detectIOS, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Suppress the browser's mini-infobar; we surface our own premium UI.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = () => setIsInstalled(detectStandalone());
    standaloneQuery.addEventListener?.('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      standaloneQuery.removeEventListener?.('change', onDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    return choice.outcome;
  }, [deferredPrompt]);

  const value = useMemo<PwaInstallContextValue>(() => {
    const canPrompt = Boolean(deferredPrompt) && !isInstalled;
    return {
      canPrompt,
      isInstalled,
      isIOS,
      isInstallable: !isInstalled && (canPrompt || isIOS),
      promptInstall,
    };
  }, [deferredPrompt, isInstalled, isIOS, promptInstall]);

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error('usePwaInstall must be used within a <PwaInstallProvider>');
  }
  return ctx;
}
