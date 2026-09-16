export const UPDATE_CHECK_INTERVAL_MS = 60_000;

export const UPDATE_PROMPT_COPY = {
  title: 'Update ayaa la sameeyay',
  body: 'Fadlan aqbal si aad u hesho isbedelka cusub.',
  accept: 'Aqbal',
  later: 'Goor dambe',
  bannerHint: 'Update cusub ayaa diyaar ah',
} as const;

export function attachServiceWorkerUpdateChecks(
  registration: { update: () => Promise<unknown> },
  options?: {
    intervalMs?: number;
    isOnline?: () => boolean;
    documentRef?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
    interval?: (handler: () => void, ms: number) => number;
    clearInterval?: (id: number) => void;
  }
): () => void {
  const intervalMs = options?.intervalMs ?? UPDATE_CHECK_INTERVAL_MS;
  const isOnline = options?.isOnline ?? (() => navigator.onLine);
  const doc = options?.documentRef ?? document;
  const setIntervalFn = options?.interval ?? ((handler, ms) => window.setInterval(handler, ms));
  const clearIntervalFn = options?.clearInterval ?? ((id) => window.clearInterval(id));

  const check = () => {
    if (isOnline()) {
      void registration.update().catch(() => undefined);
    }
  };

  const intervalId = setIntervalFn(check, intervalMs);
  const onVisible = () => {
    if (doc.visibilityState === 'visible') check();
  };
  doc.addEventListener('visibilitychange', onVisible);

  return () => {
    clearIntervalFn(intervalId);
    doc.removeEventListener('visibilitychange', onVisible);
  };
}
