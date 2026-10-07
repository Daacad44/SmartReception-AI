import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { resolveVersionDocumentIds } from '../../infrastructure/ai/rag/enterprise-retrieval.service';
import { canApproveDeployment, canPublishDeployment } from './deployment.service';
import { staleTrainingJobCutoff } from './training-job.service';

test('version document scope accepts only unique non-empty string identifiers', () => {
  assert.deepEqual(
    resolveVersionDocumentIds({
      documents: [{ id: 'doc-1' }, { id: '' }, { id: 'doc-1' }, null, { id: 'doc-2' }],
    }),
    ['doc-1', 'doc-2']
  );
  assert.deepEqual(resolveVersionDocumentIds(null), []);
  assert.deepEqual(resolveVersionDocumentIds({ documents: 'invalid' }), []);
});

test('deployment approval and publication use explicit state gates', () => {
  assert.equal(canApproveDeployment('PENDING'), true);
  assert.equal(canApproveDeployment('CHANGES_REQUESTED'), true);
  assert.equal(canApproveDeployment('APPROVED'), false);
  assert.equal(canPublishDeployment('APPROVED'), true);
  assert.equal(canPublishDeployment('PENDING'), false);
  assert.equal(canPublishDeployment('DEPLOYED'), false);
});

test('stale training cutoff is deterministic', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');
  assert.equal(
    staleTrainingJobCutoff(now, 30 * 60 * 1000).toISOString(),
    '2026-10-05T11:30:00.000Z'
  );
});

test('safety migration enforces active-job, pending-request, and production-version uniqueness', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20261005000000_ai_training_safety_guards/migration.sql'),
    'utf8'
  );
  assert.match(sql, /ai_training_jobs_one_active_per_business/);
  assert.match(sql, /WHERE "status" IN \('QUEUED', 'RUNNING'\)/);
  assert.match(sql, /ai_deployment_requests_one_pending_per_version/);
  assert.match(sql, /ai_training_versions_one_production_per_business/);
});
