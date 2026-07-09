/**
 * Thin WebSocket client for the backend realtime gateway
 * (see backend/src/infrastructure/realtime/ws-gateway.service.ts).
 *
 * Replaces the previous Supabase realtime client. Handles:
 *   - JWT auth via `?token=` on the handshake (WS spec doesn't allow custom
 *     headers from browsers, so query string is standard).
 *   - Exponential-backoff reconnect capped at 10s.
 *   - Sending `subscribe` / `unsubscribe` messages to scope per-conversation.
 *   - Dispatching typed events (`conversation_update`, `business_update`) to
 *     registered handlers.
 *
 * Kept intentionally small — the shape of the events is stable across the
 * backend and matches what `useRealtime.ts` needs to invalidate React Query.
 */

export type ConversationUpdatePayload = { conversationId: string; type: string };

export type BusinessUpdatePayload = {
  type: 'appointment' | 'campaign' | 'customer' | 'notification' | 'ai_analytics';
  appointmentId?: string;
  campaignId?: string;
  customerId?: string;
  action?: string;
};

type Listener =
  | { event: 'conversation_update'; fn: (p: ConversationUpdatePayload) => void }
  | { event: 'business_update'; fn: (p: BusinessUpdatePayload) => void };

export interface RealtimeClientOptions {
  url: string;
  getToken: () => string | null;
}

export class RealtimeClient {
  /**
   * Give up after this many consecutive failed reconnect attempts. When the
   * handshake keeps failing (endpoint unreachable, or a JWT that the gateway
   * rejects — e.g. a platform session with no `businessId` claim), retrying
   * forever only floods the console with "WebSocket connection failed". A
   * healthy connection resets the counter on `open`, so this only trips on a
   * persistent failure. Realtime is a progressive enhancement — React Query
   * still refetches on its own when it's off.
   */
  private static readonly MAX_RECONNECT_TRIES = 8;

  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private subscribed = new Set<string>();
  private reconnectTries = 0;
  private reconnectTimer: number | null = null;
  private closedIntentionally = false;
  private gaveUp = false;

  constructor(private readonly options: RealtimeClientOptions) {}

  connect(): void {
    this.closedIntentionally = false;
    // An explicit connect() (e.g. after re-auth or a fresh mount) restarts the
    // reconnect budget so a previously exhausted client can recover.
    if (this.gaveUp) {
      this.gaveUp = false;
      this.reconnectTries = 0;
    }
    const token = this.options.getToken();
    if (!token) return; // will retry when connect() is called after login
    const url = `${this.options.url}?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectTries = 0;
      // Re-subscribe to any conversations we were listening to before reconnect.
      for (const conversationId of this.subscribed) {
        this.rawSend({ type: 'subscribe', conversationId });
      }
    };

    socket.onmessage = (event) => {
      let msg: { type?: string; payload?: unknown } | null = null;
      try {
        msg = JSON.parse(typeof event.data === 'string' ? event.data : '');
      } catch {
        return;
      }
      if (!msg?.type) return;
      for (const l of this.listeners) {
        if (l.event === msg.type) {
          try {
            (l.fn as (p: unknown) => void)(msg.payload);
          } catch (err) {
            console.warn('Realtime handler threw', err);
          }
        }
      }
    };

    socket.onclose = () => {
      this.socket = null;
      if (this.closedIntentionally) return;
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose fires next; reconnect logic lives there.
    };
  }

  disconnect(): void {
    this.closedIntentionally = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  subscribeConversation(conversationId: string): void {
    this.subscribed.add(conversationId);
    this.rawSend({ type: 'subscribe', conversationId });
  }

  unsubscribeConversation(conversationId: string): void {
    this.subscribed.delete(conversationId);
    this.rawSend({ type: 'unsubscribe', conversationId });
  }

  on(event: 'conversation_update', fn: (p: ConversationUpdatePayload) => void): () => void;
  on(event: 'business_update', fn: (p: BusinessUpdatePayload) => void): () => void;
  on(event: Listener['event'], fn: (p: never) => void): () => void {
    const listener = { event, fn } as unknown as Listener;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private rawSend(data: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.gaveUp) return;
    if (this.reconnectTries >= RealtimeClient.MAX_RECONNECT_TRIES) {
      this.gaveUp = true;
      console.warn(
        `Realtime: giving up after ${this.reconnectTries} failed connection attempts. ` +
          'Live updates are disabled for this session; data still refreshes on navigation.'
      );
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectTries, 10_000);
    this.reconnectTries++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

/**
 * Resolve the realtime WS URL from the current page origin + `VITE_API_URL`.
 * If `VITE_API_URL` is a full URL (production), swap the http/https scheme
 * for ws/wss and append the realtime path. If it's a relative path
 * (default `/api/v1`), the URL is built from `window.location`.
 */
export function resolveRealtimeUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL ?? '/api/v1';
  const suffix = '/realtime';
  if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
    return apiUrl.replace(/^http/, 'ws') + suffix;
  }
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const base = apiUrl.startsWith('/') ? apiUrl : `/${apiUrl}`;
  return `${scheme}://${window.location.host}${base}${suffix}`;
}
