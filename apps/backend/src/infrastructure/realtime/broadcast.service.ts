import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config';
import { logger } from '../../core/logger';

let supabaseAdmin: SupabaseClient | null = null;

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

/** Push instant UI updates via Supabase broadcast (complements postgres_changes). */
export async function broadcastConversationEvent(
  businessId: string,
  payload: { conversationId: string; type: 'message' | 'conversation' }
): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  try {
    const channel = client.channel(`business-${businessId}`);
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'conversation_update',
      payload,
    });
    await client.removeChannel(channel);
  } catch (error) {
    logger.debug('Realtime broadcast failed (non-fatal)', { error, businessId });
  }
}

export async function broadcastBusinessEvent(
  businessId: string,
  payload: {
    type: 'appointment' | 'campaign' | 'customer' | 'notification';
    appointmentId?: string;
    campaignId?: string;
    customerId?: string;
    action?: string;
  }
): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  try {
    const channel = client.channel(`business-${businessId}`);
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'business_update',
      payload,
    });
    await client.removeChannel(channel);
  } catch (error) {
    logger.debug('Business broadcast failed (non-fatal)', { error, businessId });
  }
}
