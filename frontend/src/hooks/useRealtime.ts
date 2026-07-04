import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { RealtimeClient, resolveRealtimeUrl } from '@/lib/realtime-client';

/**
 * Shared realtime client instance. Reused across every hook that needs
 * realtime — a single WebSocket per browser tab, one JWT-authenticated
 * connection multiplexing all events for the user's current business.
 */
let sharedClient: RealtimeClient | null = null;
let connectRefCount = 0;

function getClient(): RealtimeClient {
  if (!sharedClient) {
    sharedClient = new RealtimeClient({
      url: resolveRealtimeUrl(),
      getToken: () => useAuthStore.getState().accessToken,
    });
  }
  return sharedClient;
}

function retainConnection(): () => void {
  const client = getClient();
  if (connectRefCount === 0) client.connect();
  connectRefCount++;
  return () => {
    connectRefCount--;
    if (connectRefCount === 0) {
      client.disconnect();
    }
  };
}

/**
 * Business-wide realtime: conversations, appointments, customers, campaigns,
 * notifications, ai-analytics. Same invalidation surface the Supabase-backed
 * `useRealtime` covered before the migration.
 */
export function useBusinessRealtime(userId?: string | null) {
  const businessId = useAuthStore((s) => s.currentBusinessId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!businessId || !accessToken) return;

    const release = retainConnection();
    const client = getClient();

    const offConv = client.on('conversation_update', ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'bundle'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['conversation-activity', conversationId] });
      }
    });

    const offBusiness = client.on('business_update', (payload) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      switch (payload.type) {
        case 'appointment':
          queryClient.invalidateQueries({ queryKey: ['appointments'] });
          break;
        case 'campaign':
          queryClient.invalidateQueries({ queryKey: ['campaigns'] });
          break;
        case 'customer':
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          break;
        case 'notification':
          // already invalidated above
          break;
        case 'ai_analytics':
          queryClient.invalidateQueries({ queryKey: ['ai-analytics'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'bundle'] });
          break;
      }
    });

    return () => {
      offConv();
      offBusiness();
      release();
    };
    // userId currently unused — kept in the signature for the callers that
    // previously passed it so the API shape stays stable.
  }, [businessId, accessToken, userId, queryClient]);
}

/**
 * Conversation-scoped realtime. Subscribes to the specific conversation on
 * the shared socket so message updates arrive even when the business-wide
 * event doesn't carry a conversationId.
 */
export function useConversationRealtime(conversationId: string | null) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId || !accessToken) return;

    const release = retainConnection();
    const client = getClient();
    client.subscribeConversation(conversationId);

    const off = client.on('conversation_update', (payload) => {
      if (payload.conversationId !== conversationId) return;
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'bundle'] });
    });

    return () => {
      off();
      client.unsubscribeConversation(conversationId);
      release();
    };
  }, [conversationId, accessToken, queryClient]);
}
