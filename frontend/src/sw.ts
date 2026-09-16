/// <reference lib="webworker" />
/**
 * SomReception AI — custom service worker (Workbox / injectManifest).
 *
 * Responsibilities:
 *  - Precache the built app shell (self.__WB_MANIFEST is injected at build time).
 *  - Runtime-cache fonts, images and GET API responses for offline use.
 *  - Serve the SPA shell for navigations, with an offline.html ultimate fallback.
 *  - Handle Web Push notifications + notification clicks.
 *  - Apply updates only after the user accepts (SKIP_WAITING message).
 */
import { clientsClaim } from 'workbox-core';
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  matchPrecache,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const OFFLINE_URL = 'offline.html';

// ---------------------------------------------------------------------------
// Precaching (app shell)
// ---------------------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ---------------------------------------------------------------------------
// Runtime caching
// ---------------------------------------------------------------------------

// Google Fonts stylesheets — refresh in the background, serve instantly.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
);

// Google Fonts webfont files — cache long-term.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// Images (icons, avatars, uploaded media).
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// Dashboard / billing reads — never race a 6s timeout against a slow query
// and then serve stale JSON that can crash the UI. Wait for the network;
// only fall back to cache when the request actually fails (true offline).
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    (url.pathname.includes('/api/v1/analytics') || url.pathname.includes('/api/v1/billing')),
  new NetworkFirst({
    cacheName: 'api-cache-realtime',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 }),
    ],
  })
);

// Other API reads — network-first so data is fresh online, cached copy served offline.
// Works cross-origin (api.somreception.com) and same-origin (dev proxy /api).
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.includes('/api/v1/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  })
);

// ---------------------------------------------------------------------------
// SPA navigation handling + offline fallback
// ---------------------------------------------------------------------------
const navigationHandler = createHandlerBoundToURL('index.html');
registerRoute(
  new NavigationRoute(navigationHandler, {
    // Never hijack API / webhook / auth-callback style requests.
    denylist: [/^\/api\//, /^\/webhook/, /\/[^/?]+\.[^/]+$/],
  })
);

// Ultimate fallback when even the precached shell is unavailable.
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    const offline = await matchPrecache(OFFLINE_URL);
    if (offline) return offline;
  }
  return Response.error();
});

// ---------------------------------------------------------------------------
// Update lifecycle
// ---------------------------------------------------------------------------
// First install activates immediately so offline/push work on the first visit.
// Later deploys wait: UpdatePrompt posts SKIP_WAITING after the user taps Aqbal.
self.addEventListener('install', (event) => {
  const isFirstInstall = !self.registration.active;
  if (isFirstInstall) {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Take control of open pages as soon as this SW activates (so offline works
// on the very first load without a manual refresh).
clientsClaim();

// ---------------------------------------------------------------------------
// Web Push notifications
// ---------------------------------------------------------------------------
interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  renotify?: boolean;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'SomReception AI';
  const url = payload.url || (payload.data?.url as string | undefined) || '/';
  const options: NotificationOptions = {
    body: payload.body || '',
    icon: payload.icon || '/brand/pwa-192.png',
    badge: payload.badge || '/brand/favicon-64.png',
    tag: payload.tag,
    renotify: payload.renotify ?? Boolean(payload.tag),
    requireInteraction: payload.requireInteraction ?? false,
    data: { ...(payload.data || {}), url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }

      const anyClient = allClients[0];
      if (anyClient) {
        await anyClient.focus();
        if ('navigate' in anyClient) {
          try {
            await anyClient.navigate(targetUrl);
          } catch {
            /* navigation may be blocked cross-origin — focus is enough */
          }
        }
        return;
      }

      await self.clients.openWindow(targetUrl);
    })()
  );
});
