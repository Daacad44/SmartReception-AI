import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAssignBusinessRole,
  createInvitationSecret,
  hashInvitationToken,
  invitationTokenMatches,
  isInvitationAcceptable,
  resolveInvitationStatus,
  sanitizeInvitation,
} from './invitation.policy';

test('createInvitationSecret returns a hashed token that matches', () => {
  const { token, tokenHash } = createInvitationSecret();
  assert.equal(token.length, 64);
  assert.equal(tokenHash, hashInvitationToken(token));
  assert.equal(invitationTokenMatches(token, tokenHash, null), true);
  assert.equal(invitationTokenMatches('deadbeef', tokenHash, null), false);
});

test('legacy plaintext tokens still match', () => {
  assert.equal(invitationTokenMatches('legacy-token', null, 'legacy-token'), true);
  assert.equal(invitationTokenMatches('legacy-token', 'legacy-token', null), true);
});

test('canAssignBusinessRole protects OWNER and platform escalation', () => {
  assert.equal(canAssignBusinessRole('OWNER', 'OWNER'), false);
  assert.equal(canAssignBusinessRole('OWNER', 'ADMIN'), true);
  assert.equal(canAssignBusinessRole('ADMIN', 'ADMIN'), false);
  assert.equal(canAssignBusinessRole('ADMIN', 'MANAGER'), true);
  assert.equal(canAssignBusinessRole('MANAGER', 'AGENT'), false);
  assert.equal(canAssignBusinessRole('AGENT', 'AGENT'), false);
});

test('resolveInvitationStatus covers revoke, accept, and expiry', () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);
  assert.equal(resolveInvitationStatus({ status: 'PENDING', expiresAt: future }), 'PENDING');
  assert.equal(resolveInvitationStatus({ status: 'PENDING', acceptedAt: new Date(), expiresAt: future }), 'ACCEPTED');
  assert.equal(resolveInvitationStatus({ status: 'PENDING', revokedAt: new Date(), expiresAt: future }), 'REVOKED');
  assert.equal(resolveInvitationStatus({ status: 'PENDING', expiresAt: past }), 'EXPIRED');
  assert.equal(isInvitationAcceptable({ status: 'PENDING', expiresAt: future }), true);
  assert.equal(isInvitationAcceptable({ status: 'PENDING', expiresAt: past }), false);
});

test('sanitizeInvitation strips secrets', () => {
  const clean = sanitizeInvitation({ id: '1', token: 'secret', tokenHash: 'hash', email: 'a@b.c' });
  assert.equal('token' in clean, false);
  assert.equal('tokenHash' in clean, false);
  assert.equal(clean.email, 'a@b.c');
});
