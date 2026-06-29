import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config';
import { logger } from '../../core/logger';

let supabaseAdmin: SupabaseClient | null = null;
const channelPool = new Map<string, Promise<RealtimeChannel>>();

function getAdminClient(): SupabaseClient | null {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    return null;
  }
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
}

async function getBusinessChannel(businessId: string): Promise<RealtimeChannel | null> {
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

/** Push instant UI updates via Supabase broadcast (complements postgres_changes). */
export async function broadcastConversationEvent(
  businessId: string,
  payload: { conversationId: string; type: string }
): Promise<void> {
  const channel = await getBusinessChannel(businessId);
  if (!channel) return;

  try {
    await channel.send({
      type: 'broadcast',
      event: 'conversation_update',
      payload,
    });
  } catch (error) {
    logger.debug('Realtime broadcast failed (non-fatal)', { error, businessId });
  }
}

export async function broadcastBusinessEvent(
  businessId: string,
  payload: {
    type: 'appointment' | 'campaign' | 'customer' | 'notification' | 'ai_analytics';
    appointmentId?: string;
    campaignId?: string;
    customerId?: string;
    action?: string;
  }
): Promise<void> {
  const channel = await getBusinessChannel(businessId);
  if (!channel) return;

  try {
    await channel.send({
      type: 'broadcast',
      event: 'business_update',
      payload,
    });
  } catch (error) {
    logger.debug('Business broadcast failed (non-fatal)', { error, businessId });
  }
}

export async function broadcastAiAnalyticsUpdate(businessId: string): Promise<void> {
  await broadcastBusinessEvent(businessId, { type: 'ai_analytics', action: 'updated' });
}
