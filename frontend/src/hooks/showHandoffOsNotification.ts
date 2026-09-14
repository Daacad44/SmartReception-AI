const NOTIFICATION_ICON = '/brand/pwa-192.png';
const SW_READY_TIMEOUT_MS = 1000;

export function handoffNotificationUrl(conversationId?: string): string {
  return conversationId
    ? `/conversations?conversation=${conversationId}`
    : '/conversations';
}

export async function resolveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;

    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  }
}

/**
 * Show an OS notification without crashing mobile Chrome / installed PWAs.
 * `new Notification()` is illegal there; ServiceWorkerRegistration.showNotification()
 * is required. Desktop-without-SW (Vite dev) still uses the constructor, try/caught.
 */
export async function showHandoffOsNotification(params: {
  title: string;
  body: string;
  tag: string;
  url: string;
}): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  const options: NotificationOptions = {
    body: params.body,
    tag: params.tag,
    icon: NOTIFICATION_ICON,
    data: { url: params.url },
  };

  try {
    const registration = await resolveServiceWorkerRegistration();
    if (registration) {
      await registration.showNotification(params.title, options);
      return;
    }

    try {
      const notification = new Notification(params.title, options);
      notification.onclick = () => {
        window.focus();
        window.location.href = params.url;
      };
    } catch {
      // Android Chrome: Illegal constructor. No SW → skip silently.
    }
  } catch {
    // Missing/inactive SW, permission race, or showNotification failure.
  }
}
