import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Business-wide realtime: conversations, appointments, customers, notifications.
 * Uses channel `business-{businessId}` — must not share this name with other hooks.
 */
export function useBusinessRealtime(userId?: string | null) {
  const businessId = useAuthStore((s) => s.currentBusinessId);
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !businessId) return;

    let channel = supabase.channel(`business-${businessId}`);

    channel = channel
      .on('broadcast', { event: 'conversation_update' }, (payload) => {
        const convId = (payload.payload as { conversationId?: string })?.conversationId;
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        if (convId) {
          queryClient.invalidateQueries({ queryKey: ['messages', convId] });
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `businessId=eq.${businessId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `businessId=eq.${businessId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['appointments'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `businessId=eq.${businessId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `businessId=eq.${businessId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      );

    if (userId) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `userId=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, userId, queryClient]);
}

/**
 * Conversation-scoped message realtime. Uses a dedicated channel per conversation
 * so it never collides with the business-wide channel.
 */
export function useConversationRealtime(conversationId: string | null) {
  const businessId = useAuthStore((s) => s.currentBusinessId);
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !conversationId) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const messageChannel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversationId=eq.${conversationId}`,
        },
        invalidate
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`,
        },
        invalidate
      )
      .subscribe();

    let businessChannel: ReturnType<typeof supabase.channel> | null = null;
    if (businessId) {
      businessChannel = supabase
        .channel(`business-${businessId}`)
        .on('broadcast', { event: 'conversation_update' }, (payload) => {
          const convId = (payload.payload as { conversationId?: string })?.conversationId;
          if (!convId || convId === conversationId) invalidate();
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(messageChannel);
      if (businessChannel) supabase.removeChannel(businessChannel);
    };
  }, [conversationId, businessId, queryClient]);
}
