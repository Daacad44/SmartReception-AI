import type { Server as HttpServer, IncomingMessage } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../../config';
import { logger } from '../../core/logger';
import type { JwtPayload } from '@smartreception/shared';

/**
 * Realtime WebSocket gateway. Replaces the Supabase Realtime subscription
 * the frontend used before the migration.
 *
 * Wire format (both directions): JSON with a `type` discriminator.
 *
 *   Client → server:
 *     { "type": "subscribe",   "conversationId": "…" }
 *     { "type": "unsubscribe", "conversationId": "…" }
 *
 *   Server → client:
 *     { "type": "hello", "businessId": "…" }
 *     { "type": "conversation_update", "payload": { conversationId, type } }
 *     { "type": "business_update",     "payload": { type, appointmentId?, campaignId?, customerId?, action? } }
 *     { "type": "ping" }
 *
 * The shapes match what `useRealtime.ts` already consumes from Supabase, so
 * the client can invalidate the same React Query keys with no shape changes.
 *
 * Auth: JWT via `?token=<accessToken>` on the WS handshake (browsers can't
 * set headers on `new WebSocket(...)`). Rejects the connection if the token
 * is missing, invalid, expired, or lacks a `businessId` claim.
 *
 * Scope note: single-instance in-memory only. Multi-replica fan-out (via
 * Redis pub/sub) is a follow-up — see docs/MIGRATING_OFF_SUPABASE.md §Stage 5.
 */

export interface ConversationEventPayload {
  conversationId: string;
  type: string;
}

export interface BusinessEventPayload {
  type: 'appointment' | 'campaign' | 'customer' | 'notification' | 'ai_analytics';
  appointmentId?: string;
  campaignId?: string;
  customerId?: string;
  action?: string;
}

interface Client {
  socket: WebSocket;
  businessId: string;
  userId: string;
  conversations: Set<string>;
  isAlive: boolean;
}

class WsGateway {
  private wss: WebSocketServer | null = null;
  private clients = new Set<Client>();
  private byBusiness = new Map<string, Set<Client>>();
  private byConversation = new Map<string, Set<Client>>();
  private heartbeat: NodeJS.Timeout | null = null;

  attach(server: HttpServer, path = '/api/v1/realtime'): void {
    if (this.wss) return;

    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== path) return; // let other upgrade handlers try

      const payload = this.authenticate(req);
      if (!payload) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.wss!.emit('connection', ws, req, payload);
      });
    });

    this.wss.on('connection', (socket: WebSocket, _req: IncomingMessage, payload: JwtPayload) => {
      this.registerClient(socket, payload);
    });

    // 30s server-side ping/liveness — drops sockets that go silent.
    this.heartbeat = setInterval(() => this.pingAll(), 30_000);
    this.heartbeat.unref?.();
  }

  detach(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.wss?.close();
    this.wss = null;
    this.clients.clear();
    this.byBusiness.clear();
    this.byConversation.clear();
  }

  emitConversationEvent(businessId: string, payload: ConversationEventPayload): void {
    const message = JSON.stringify({ type: 'conversation_update', payload });
    // Business-wide inbox update
    this.byBusiness.get(businessId)?.forEach((c) => this.safeSend(c, message));
    // Anyone with the conversation open also gets it (dedup'd via socket instance)
    this.byConversation.get(payload.conversationId)?.forEach((c) => {
      if (!this.byBusiness.get(businessId)?.has(c)) this.safeSend(c, message);
    });
  }

  emitBusinessEvent(businessId: string, payload: BusinessEventPayload): void {
    const message = JSON.stringify({ type: 'business_update', payload });
    this.byBusiness.get(businessId)?.forEach((c) => this.safeSend(c, message));
  }

  isAttached(): boolean {
    return this.wss !== null;
  }

  connectedCount(): number {
    return this.clients.size;
  }

  private authenticate(req: IncomingMessage): JwtPayload | null {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token) return null;
      const claims = jwt.verify(token, config.jwt.secret) as JwtPayload;
      if (!claims.userId || !claims.businessId) return null;
      return claims;
    } catch (err) {
      logger.debug('WS handshake auth failed', { err });
      return null;
    }
  }

  private registerClient(socket: WebSocket, payload: JwtPayload): void {
    const client: Client = {
      socket,
      businessId: payload.businessId!,
      userId: payload.userId,
      conversations: new Set(),
      isAlive: true,
    };
    this.clients.add(client);
    this.getBucket(this.byBusiness, client.businessId).add(client);

    socket.on('pong', () => {
      client.isAlive = true;
    });

    socket.on('message', (data) => {
      let msg: { type?: string; conversationId?: string } | null = null;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return; // silent — malformed client messages are cheap to drop
      }
      if (!msg?.type) return;
      if (msg.type === 'subscribe' && msg.conversationId) {
        client.conversations.add(msg.conversationId);
        this.getBucket(this.byConversation, msg.conversationId).add(client);
      } else if (msg.type === 'unsubscribe' && msg.conversationId) {
        client.conversations.delete(msg.conversationId);
        this.byConversation.get(msg.conversationId)?.delete(client);
      }
    });

    socket.on('close', () => this.removeClient(client));
    socket.on('error', () => this.removeClient(client));

    this.safeSend(client, JSON.stringify({ type: 'hello', businessId: client.businessId }));
  }

  private removeClient(client: Client): void {
    this.clients.delete(client);
    this.byBusiness.get(client.businessId)?.delete(client);
    for (const convId of client.conversations) {
      this.byConversation.get(convId)?.delete(client);
    }
  }

  private pingAll(): void {
    for (const client of this.clients) {
      if (!client.isAlive) {
        client.socket.terminate();
        this.removeClient(client);
        continue;
      }
      client.isAlive = false;
      try {
        client.socket.ping();
      } catch {
        this.removeClient(client);
      }
    }
  }

  private safeSend(client: Client, data: string): void {
    if (client.socket.readyState !== WebSocket.OPEN) return;
    try {
      client.socket.send(data);
    } catch (err) {
      logger.debug('WS send failed', { err });
    }
  }

  private getBucket<T>(map: Map<string, Set<T>>, key: string): Set<T> {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = new Set<T>();
      map.set(key, bucket);
    }
    return bucket;
  }
}

export const wsGateway = new WsGateway();
