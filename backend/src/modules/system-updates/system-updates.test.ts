import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { compareVersions } from './system-updates.service';

test('system versions are ordered numerically rather than lexically', () => {
  assert.ok(compareVersions('1.10.0', '1.9.9') > 0);
  assert.ok(compareVersions('1.2.0', '1.1.1') > 0);
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
});

test('system update migration creates release, state, history, and initial release', () => {
  const sql = readFileSync(resolve(process.cwd(), 'prisma/migrations/20261014000000_business_system_updates/migration.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE "platform_system_releases"/);
  assert.match(sql, /CREATE TABLE "business_system_update_states"/);
  assert.match(sql, /CREATE TABLE "business_system_update_installations"/);
  assert.match(sql, /'1\.2\.0'/);
});
