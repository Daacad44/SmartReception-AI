import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { buildLegacyReleaseSnapshot } from './ai-agent-studio.service';
import {
  applyAgentDiscoverySchema,
  createAgentReleaseSchema,
  updateAgentDraftSchema,
  upsertAgentSkillSchema,
} from './ai-agent-studio.schemas';
import { AGENT_DISCOVERY_TEMPLATES, templateForIndustry } from './agent-discovery.templates';
import { knowledgeChecksum } from './agent-knowledge.service';
import { evaluateReleaseSnapshot } from './agent-evaluation.service';

test('legacy release snapshots retain immutable version identity and knowledge', () => {
  assert.deepEqual(
    buildLegacyReleaseSnapshot({ id: 'version-7', snapshotData: { documents: [{ id: 'doc-1' }] } }),
    {
      schemaVersion: 1,
      channel: 'WHATSAPP',
      legacyTrainingVersionId: 'version-7',
      knowledgeSnapshot: { documents: [{ id: 'doc-1' }] },
    }
  );
});

test('agent draft schema rejects empty writes and accepts governed sections', () => {
  assert.equal(updateAgentDraftSchema.safeParse({ expectedRevision: 1 }).success, false);
  assert.equal(
    updateAgentDraftSchema.safeParse({
      instructions: { role: 'Receptionist' },
      escalationPolicy: { handoverOnMissingKnowledge: true },
      expectedRevision: 1,
    }).success,
    true
  );
});

test('release and skill schemas enforce professional safety inputs', () => {
  assert.equal(createAgentReleaseSchema.safeParse({ changeSummary: '' }).success, false);
  assert.equal(createAgentReleaseSchema.safeParse({ changeSummary: 'Add approved clinic FAQs' }).success, true);
  assert.equal(
    upsertAgentSkillSchema.safeParse({
      enabled: true,
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      configuration: {},
    }).success,
    true
  );
});

test('Phase 2 migration creates and backfills the complete Agent Studio foundation', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20261006000000_ai_agent_studio_foundation/migration.sql'),
    'utf8'
  );
  for (const table of [
    'ai_agents',
    'ai_agent_drafts',
    'ai_agent_releases',
    'ai_agent_release_approvals',
    'ai_agent_skill_configurations',
    'ai_agent_executions',
    'ai_agent_evaluation_runs',
    'ai_agent_evaluation_cases',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE "${table}"`));
  }
  assert.match(sql, /Migrated from the legacy AI Training workspace/);
  assert.match(sql, /ON CONFLICT \("sourceTrainingVersionId"\) DO NOTHING/);
});

test('Phase 4 discovery selects category templates with a safe general fallback', () => {
  assert.equal(templateForIndustry('CLINIC').id, 'healthcare-reception');
  assert.equal(templateForIndustry('ECOMMERCE').id, 'commerce-sales');
  assert.equal(templateForIndustry('UNKNOWN').id, 'general-business');
  assert.ok(AGENT_DISCOVERY_TEMPLATES.every((template) => template.boundaries.length > 0));
});

test('Phase 4 discovery requires enough business context to train professionally', () => {
  assert.equal(applyAgentDiscoverySchema.safeParse({}).success, false);
  assert.equal(applyAgentDiscoverySchema.safeParse({
    expectedRevision: 2,
    templateId: 'healthcare-reception',
    answers: {
      primaryGoal: 'Help patients get accurate clinic information and appointments.',
      customerTypes: ['Patients'],
      commonQuestions: ['When is the clinic open?'],
      prohibitedTopics: ['Medical diagnosis'],
      handoverRules: ['Handover every clinical question'],
      tone: 'PROFESSIONAL',
      languages: ['so', 'en'],
      operatingNotes: '',
    },
  }).success, true);
});

test('Phase 5 knowledge checksums detect identical content deterministically', () => {
  const document = { title: 'Pricing', content: 'Approved price list', question: null, answer: null };
  assert.equal(knowledgeChecksum(document), knowledgeChecksum({ ...document }));
  assert.notEqual(knowledgeChecksum(document), knowledgeChecksum({ ...document, content: 'Changed' }));
});

test('Phase 6 release gate blocks ungrounded agents and passes governed snapshots', () => {
  const unsafe = evaluateReleaseSnapshot({}, 0);
  assert.ok(unsafe.some((gate) => gate.critical && !gate.passed));
  const safe = evaluateReleaseSnapshot({
    draft: { instructions: { role: 'Professional business receptionist', boundaries: ['Never invent facts'] }, escalationPolicy: { handoverOnMissingKnowledge: true } },
    skills: [{ skillKey: 'human.handover', enabled: true }],
  }, 2);
  assert.equal(safe.filter((gate) => gate.critical && !gate.passed).length, 0);
});
