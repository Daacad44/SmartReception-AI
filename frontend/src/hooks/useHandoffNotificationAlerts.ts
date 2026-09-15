import { useEffect, useRef } from 'react';
import { useNotifications } from '@/hooks/useApi';
import { handoffNotificationUrl, showHandoffOsNotification } from './showHandoffOsNotification';
import {
  loadHandoffSeenIds,
  markHandoffSeen,
  osNotificationTag,
  seedHandoffSeenIds,
} from './handoffAlertDedupe';

function playNotificationSound() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.15);
  } catch {
    // Audio not available
  }
}

/** Plays sound and desktop notifications for urgent handoff alerts. */
export function useHandoffNotificationAlerts() {
  const { data: notifications } = useNotifications();
  const seenRef = useRef<Set<string>>(loadHandoffSeenIds());
  const seededRef = useRef(false);

  useEffect(() => {
    if (!notifications) return;

    if (!seededRef.current) {
      seededRef.current = true;
      seedHandoffSeenIds(
        seenRef.current,
        notifications.map((notification) => notification.id)
      );
      return;
    }

    for (const notification of notifications) {
      if (seenRef.current.has(notification.id)) continue;

      const data = notification.data as Record<string, unknown> | null | undefined;
      const shouldAlert =
        data?.sound === true ||
        notification.title.toLowerCase().includes('human') ||
        notification.title.toLowerCase().includes('escalat');

      if (shouldAlert && !notification.read) {
        playNotificationSound();

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const conversationId =
            typeof data?.conversationId === 'string' ? data.conversationId : undefined;
          void showHandoffOsNotification({
            title: notification.title,
            body: notification.message,
            tag: osNotificationTag(conversationId, notification.id),
            url: handoffNotificationUrl(conversationId),
          }).catch(() => undefined);
        }
      }

      markHandoffSeen(seenRef.current, notification.id);
    }
  }, [notifications]);
}

export function requestDesktopNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}
