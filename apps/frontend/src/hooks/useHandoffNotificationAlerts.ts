import { useEffect, useRef } from 'react';
import { useNotifications } from '@/hooks/useApi';

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
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!notifications?.length) return;

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
          const n = new Notification(notification.title, {
            body: notification.message,
            tag: notification.id,
          });
          if (conversationId) {
            n.onclick = () => {
              window.focus();
              window.location.href = `/conversations?conversation=${conversationId}`;
            };
          }
        }
      }

      seenRef.current.add(notification.id);
    }
  }, [notifications]);
}

export function requestDesktopNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}
