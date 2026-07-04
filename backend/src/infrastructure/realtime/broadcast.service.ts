import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config';
import { logger } from '../../core/logger';
import {
  wsGateway,
  type BusinessEventPayload,
  type ConversationEventPayload,
} from './ws-gateway.service';

/**
 * Broadcast facade — the ~14 services that emit realtime events (conversations,
 * appointments, campaigns, ai-analytics, workflow-engine, sales-flow, etc.)
 * call these three functions. Their signatures stay stable across the
 * Supabase-→-self-host migration.
 *
 * During the transition this dual-emits:
 *   1. To the new Express WebSocket gateway (wsGateway) — the target end state.
 *   2. To the legacy Supabase realtime channel — kept live so that any client
 *      still on `frontend/src/lib/supabase.ts` continues to receive
 *      events until every consumer has switched to the WS client.
 *
 * When the Supabase env vars are unset (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`),
 * the Supabase path silently no-ops — the WS path handles everything on its own.
 * Deleting the Supabase code block is the final cleanup step in Stage 5.
 */

let supabaseAdmin: SupabaseClient | null = null;
const channelPool = new Map<string, Promise<RealtimeChannel>>();

function getAdminClient(): SupabaseClient | null {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) return null;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
}

async function getSupabaseChannel(businessId: string): Promise<RealtimeChannel | null> {
  const client = getAdminClient();
  if (!client) return null;

  const key = `business-${businessId}`;
  let pending = channelPool.get(key);
  if (!pending) {
    pending = (async () => {
      const channel = client.channel(key);
      await channel.subscribe();
      return channel;
    })();
    channelPool.set(key, pending);
  }

  try {
    return await pending;
  } catch (error) {
    channelPool.delete(key);
    logger.debug('Realtime channel subscribe failed', { error, businessId });
    return null;
  }
}

async function sendViaSupabase(
  businessId: string,
  event: 'conversation_update' | 'business_update',
  payload: unknown
): Promise<void> {
  const channel = await getSupabaseChannel(businessId);
  if (!channel) return;
  try {
    await channel.send({ type: 'broadcast', event, payload });
  } catch (error) {
    logger.debug('Realtime broadcast failed (non-fatal)', { error, businessId });
  }
}

export async function broadcastConversationEvent(
  businessId: string,
  payload: ConversationEventPayload
): Promise<void> {
  // Primary: in-process WS fan-out. Cheap, synchronous, no network hop.
  wsGateway.emitConversationEvent(businessId, payload);
  // Secondary (transitional): Supabase realtime, so any client still on the
  // old lib/supabase.ts keeps receiving events.
  await sendViaSupabase(businessId, 'conversation_update', payload);
}

export async function broadcastBusinessEvent(
  businessId: string,
  payload: BusinessEventPayload
): Promise<void> {
  wsGateway.emitBusinessEvent(businessId, payload);
  await sendViaSupabase(businessId, 'business_update', payload);
}

export async function broadcastAiAnalyticsUpdate(businessId: string): Promise<void> {
  await broadcastBusinessEvent(businessId, { type: 'ai_analytics', action: 'updated' });
}
