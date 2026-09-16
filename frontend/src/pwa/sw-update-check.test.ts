import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { attachServiceWorkerUpdateChecks, UPDATE_PROMPT_COPY } from './sw-update-check.ts';

describe('PWA update acceptance copy', () => {
  it('asks the user to accept in Somali', () => {
    assert.equal(UPDATE_PROMPT_COPY.title, 'Update ayaa la sameeyay');
    assert.equal(UPDATE_PROMPT_COPY.accept, 'Aqbal');
    assert.match(UPDATE_PROMPT_COPY.body, /aqbal/i);
  });
});

describe('attachServiceWorkerUpdateChecks', () => {
  it('checks for updates on an interval and when the tab becomes visible', () => {
    let updates = 0;
    const registration = {
      update: async () => {
        updates += 1;
      },
    };

    const listeners = new Map<string, () => void>();
    const intervals: Array<{ id: number; handler: () => void }> = [];
    let nextId = 1;
    let visibilityState: DocumentVisibilityState = 'hidden';

    const stop = attachServiceWorkerUpdateChecks(registration, {
      intervalMs: 1000,
      isOnline: () => true,
      documentRef: {
        get visibilityState() {
          return visibilityState;
        },
        addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
          if (typeof listener === 'function') listeners.set(type, listener as () => void);
        },
        removeEventListener(type: string) {
          listeners.delete(type);
        },
      },
      interval: (handler) => {
        const id = nextId++;
        intervals.push({ id, handler });
        return id;
      },
      clearInterval: (id) => {
        const index = intervals.findIndex((row) => row.id === id);
        if (index >= 0) intervals.splice(index, 1);
      },
    });

    assert.equal(intervals.length, 1);
    intervals[0]?.handler();
    assert.equal(updates, 1);

    visibilityState = 'visible';
    listeners.get('visibilitychange')?.();
    assert.equal(updates, 2);

    stop();
    assert.equal(intervals.length, 0);
    assert.equal(listeners.size, 0);
  });

  it('does not poll while offline', () => {
    let updates = 0;
    const intervals: Array<() => void> = [];
    attachServiceWorkerUpdateChecks(
      {
        update: async () => {
          updates += 1;
        },
      },
      {
        isOnline: () => false,
        documentRef: {
          visibilityState: 'visible',
          addEventListener() {},
          removeEventListener() {},
        },
        interval: (handler) => {
          intervals.push(handler);
          return 1;
        },
        clearInterval() {},
      }
    );

    intervals[0]?.();
    assert.equal(updates, 0);
  });
});
