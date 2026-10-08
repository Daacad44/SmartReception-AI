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
import { enforceRuntimePolicy } from './agent-runtime.service';
import { handoffPriority } from '../conversations/handoff-operations.service';
import { parseActionConfirmation } from './agent-action.service';
import { percent } from './agent-analytics.service';
import { isIncludedInRollout, rolloutBucket } from './agent-rollout.service';
import { matchRoutingRule } from './agent-routing.service';
import { validateWorkflow } from './agent-workflow.service';
import { scoreSimulation } from './agent-simulation.service';
import { normalizeChannelMessage } from './agent-operations.service';

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

test('Phase 7 runtime hands over low-grounding responses and blocks unconfirmed writes', () => {
  const unsafe = enforceRuntimePolicy({ content: 'Guess', intent: 'general', confidence: 0.2, actions: [{ type: 'none' }], _meta: { missingKnowledge: true } as never }, [], false);
  assert.equal(unsafe.status, 'HANDED_OVER');
  assert.equal(unsafe.response.actions[0]?.type, 'escalate');

  const write = enforceRuntimePolicy(
    { content: 'Ready', intent: 'booking', confidence: 0.9, actions: [{ type: 'book_appointment', data: {} }] },
    [{ skillKey: 'appointment.create', enabled: true, requiresConfirmation: true }],
    true
  );
  assert.equal(write.status, 'HANDED_OVER');
  assert.deepEqual(write.blockedActions, ['book_appointment']);
  assert.equal(write.response.actions.some((action) => action.type === 'book_appointment'), false);
});

test('Phase 8 handoff priority promotes safety and grounding failures', () => {
  assert.equal(handoffPriority('Customer asked a normal question'), 'NORMAL');
  assert.equal(handoffPriority('Missing knowledge', 'HANDED_OVER'), 'HIGH');
  assert.equal(handoffPriority('Urgent emergency reported'), 'URGENT');
});

test('Phase 8 migration enforces one active handoff per conversation', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20261009000000_ai_handoff_operations/migration.sql'),
    'utf8'
  );
  assert.match(sql, /ai_handoff_cases_one_active_conversation_key/);
  assert.match(sql, /WHERE "status" IN \('OPEN', 'ACKNOWLEDGED'\)/);
});

test('Phase 9 action confirmation accepts explicit replies and rejects ambiguous text', () => {
  assert.equal(parseActionConfirmation('haa'), 'CONFIRM');
  assert.equal(parseActionConfirmation('confirm!'), 'CONFIRM');
  assert.equal(parseActionConfirmation('maya'), 'CANCEL');
  assert.equal(parseActionConfirmation('maybe later'), null);
});

test('Phase 9 migration enforces action idempotency and one pending confirmation', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20261010000000_agent_business_actions/migration.sql'),
    'utf8'
  );
  assert.match(sql, /ai_agent_actions_idempotencyKey_key/);
  assert.match(sql, /ai_agent_actions_one_pending_confirmation_key/);
});

test('Phase 10 analytics percentages are stable for empty and populated datasets', () => {
  assert.equal(percent(0, 0), 0);
  assert.equal(percent(3, 4), 75);
  assert.equal(percent(1, 3), 33.33);
});

test('Phase 11-13 migration creates governance, rollout and routing invariants', () => {
  const sql = readFileSync(resolve(process.cwd(), 'prisma/migrations/20261011000000_agent_governance_rollout_routing/migration.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE "ai_agent_governance_policies"/);
  assert.match(sql, /ai_agent_rollout_traffic_check/);
  assert.match(sql, /ai_agent_routing_rules_one_fallback_key/);
});

test('Phase 12 rollout assignment is deterministic and respects boundaries', () => {
  assert.equal(rolloutBucket('business:conversation'), rolloutBucket('business:conversation'));
  assert.equal(isIncludedInRollout('any', 0), false);
  assert.equal(isIncludedInRollout('any', 100), true);
});

test('Phase 13 routing uses priority order and a safe fallback', () => {
  const rules = [
    { id: 'sales', keywords: ['price'], intents: ['buy'], isFallback: false },
    { id: 'fallback', keywords: [], intents: [], isFallback: true },
  ];
  assert.equal(matchRoutingRule(rules, 'What is the price?')?.id, 'sales');
  assert.equal(matchRoutingRule(rules, 'I need help')?.id, 'fallback');
});

test('Phase 14 workflow validation rejects cycles and accepts a safe graph', () => {
  const nodes = [{ id: 'start', type: 'TRIGGER', config: {} }, { id: 'end', type: 'END', config: {} }];
  assert.equal(validateWorkflow(nodes, [{ id: 'e1', source: 'start', target: 'end' }]).valid, true);
  assert.equal(validateWorkflow(nodes, [{ id: 'e1', source: 'start', target: 'end' }, { id: 'e2', source: 'end', target: 'start' }]).valid, false);
});

test('Phase 15 simulation fails critical safety regressions', () => {
  assert.deepEqual(scoreSimulation([{ passed: true, critical: true }, { passed: false, critical: true }]), { score: 50, criticalFailures: 1, passed: false });
});

test('Phase 17 channel envelope preserves channel identity', () => {
  const message = normalizeChannelMessage('WHATSAPP', 'wamid.1', ' hello ');
  assert.equal(message.channel, 'WHATSAPP');
  assert.equal(message.text, 'hello');
});

test('Phase 14-17 migration creates workflow, simulation, incident and channel stores', () => {
  const sql = readFileSync(resolve(process.cwd(), 'prisma/migrations/20261012000000_agent_automation_testing_sre_channels/migration.sql'), 'utf8');
  for (const table of ['ai_automation_workflows', 'ai_simulation_runs', 'ai_agent_incidents', 'ai_channel_bindings']) assert.match(sql, new RegExp(`CREATE TABLE "${table}"`));
});
