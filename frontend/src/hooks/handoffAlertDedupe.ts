export const HANDOFF_SEEN_STORAGE_KEY = 'sr-handoff-os-seen';
const MAX_SEEN_IDS = 200;

function getSessionStorage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

export function loadHandoffSeenIds(): Set<string> {
  const storage = getSessionStorage();
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(HANDOFF_SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function persistHandoffSeenIds(ids: Set<string>): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    const trimmed = [...ids].slice(-MAX_SEEN_IDS);
    storage.setItem(HANDOFF_SEEN_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // quota / private mode
  }
}

export function seedHandoffSeenIds(seen: Set<string>, notificationIds: string[]): Set<string> {
  for (const id of notificationIds) {
    seen.add(id);
  }
  persistHandoffSeenIds(seen);
  return seen;
}

export function markHandoffSeen(seen: Set<string>, id: string): void {
  seen.add(id);
  persistHandoffSeenIds(seen);
}

export function osNotificationTag(conversationId: string | undefined, notificationId: string): string {
  return conversationId || notificationId;
}
