import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HANDOFF_SEEN_STORAGE_KEY,
  loadHandoffSeenIds,
  markHandoffSeen,
  osNotificationTag,
  persistHandoffSeenIds,
  seedHandoffSeenIds,
} from './handoffAlertDedupe.ts';

const memory = new Map<string, string>();

function stubSessionStorage() {
  memory.clear();
  const storage = {
    getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storage,
    configurable: true,
  });
}

afterEach(() => {
  memory.clear();
});

describe('handoffAlertDedupe', () => {
  it('loads an empty set when nothing is stored', () => {
    stubSessionStorage();
    assert.equal(loadHandoffSeenIds().size, 0);
  });

  it('round-trips seen ids through sessionStorage', () => {
    stubSessionStorage();
    persistHandoffSeenIds(new Set(['a', 'b']));
    const loaded = loadHandoffSeenIds();
    assert.equal(loaded.has('a'), true);
    assert.equal(loaded.has('b'), true);
  });

  it('seeds existing notification ids without dropping prior seen values', () => {
    stubSessionStorage();
    const seen = new Set(['old']);
    seedHandoffSeenIds(seen, ['n1', 'n2']);
    assert.equal(seen.has('old'), true);
    assert.equal(seen.has('n1'), true);
    assert.equal(JSON.parse(memory.get(HANDOFF_SEEN_STORAGE_KEY) ?? '[]').includes('n2'), true);
  });

  it('markHandoffSeen persists the new id', () => {
    stubSessionStorage();
    const seen = new Set<string>();
    markHandoffSeen(seen, 'n-9');
    assert.equal(loadHandoffSeenIds().has('n-9'), true);
  });

  it('uses conversationId as the OS tag so banners collapse per conversation', () => {
    assert.equal(osNotificationTag('conv-1', 'notif-9'), 'conv-1');
    assert.equal(osNotificationTag(undefined, 'notif-9'), 'notif-9');
  });
});
