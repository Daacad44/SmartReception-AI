import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const INVITEABLE_ROLES = [
  'ADMIN',
  'MANAGER',
  'AGENT',
  'VIEWER',
  'RECEPTIONIST',
  'STAFF',
] as const;

export type InviteableRole = (typeof INVITEABLE_ROLES)[number];

const ROLE_RANK: Record<string, number> = {
  VIEWER: 0,
  STAFF: 1,
  RECEPTIONIST: 2,
  AGENT: 3,
  MANAGER: 4,
  ADMIN: 5,
  OWNER: 6,
};

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createInvitationSecret(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function invitationTokenMatches(
  presented: string,
  storedHash: string | null | undefined,
  storedLegacyToken: string | null | undefined
): boolean {
  const value = presented.trim();
  if (!value) return false;
  const hashed = hashInvitationToken(value);
  if (storedHash && safeEqual(storedHash, hashed)) return true;
  if (storedHash && safeEqual(storedHash, value)) return true;
  if (storedLegacyToken && safeEqual(storedLegacyToken, value)) return true;
  return false;
}

export function canAssignBusinessRole(actorRole: string | undefined, targetRole: string): boolean {
  if (targetRole === 'OWNER') return false;
  if (!INVITEABLE_ROLES.includes(targetRole as InviteableRole)) return false;
  if (actorRole === 'OWNER') return true;
  if (actorRole === 'ADMIN') {
    return (ROLE_RANK[targetRole] ?? 99) < ROLE_RANK.ADMIN;
  }
  return false;
}

export type InvitationLifecycle = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export function resolveInvitationStatus(invitation: {
  status?: string | null;
  acceptedAt?: Date | null;
  revokedAt?: Date | null;
  expiresAt: Date;
  now?: Date;
}): InvitationLifecycle {
  if (invitation.revokedAt || invitation.status === 'REVOKED') return 'REVOKED';
  if (invitation.acceptedAt || invitation.status === 'ACCEPTED') return 'ACCEPTED';
  const now = invitation.now ?? new Date();
  if (invitation.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return 'PENDING';
}

export function isInvitationAcceptable(invitation: {
  status?: string | null;
  acceptedAt?: Date | null;
  revokedAt?: Date | null;
  expiresAt: Date;
  now?: Date;
}): boolean {
  return resolveInvitationStatus(invitation) === 'PENDING';
}

export function sanitizeInvitation<T extends { token?: string | null; tokenHash?: string | null }>(
  invitation: T
): Omit<T, 'token' | 'tokenHash'> {
  const { token: _token, tokenHash: _hash, ...rest } = invitation;
  return rest;
}
