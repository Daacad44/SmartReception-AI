import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personalizeCampaignMessage, extractTemplateVariables } from './campaign-personalization.service';
import { computeNextCampaignRun, shouldStopRecurring } from './campaign-scheduler.service';

test('personalizeCampaignMessage replaces customer and business variables', () => {
  const result = personalizeCampaignMessage('Ku soo dhawoow {{customer_name}} — {{business_name}}', {
    businessName: 'Botan Dev',
    customer: { name: 'Ahmed', phone: '252611111111', email: 'a@test.com', companyName: null, city: null, country: null },
  });
  assert.match(result, /Ahmed/);
  assert.match(result, /Botan Dev/);
  assert.doesNotMatch(result, /\{\{/);
});

test('extractTemplateVariables finds placeholders', () => {
  const vars = extractTemplateVariables('Hi {{customer_name}}, code {{discount_code}}');
  assert.deepEqual(vars.sort(), ['customer_name', 'discount_code']);
});

test('computeNextCampaignRun daily schedule advances one day', () => {
  const from = new Date('2026-06-16T10:00:00Z');
  const next = computeNextCampaignRun({ schedule: 'DAILY', from, scheduleConfig: { hour: 8, minute: 0 } });
  assert.ok(next);
  assert.ok(next!.getTime() > from.getTime());
});

test('shouldStopRecurring respects repeat count', () => {
  assert.equal(shouldStopRecurring({ runsCompleted: 3, repeatCount: 3 }), true);
  assert.equal(shouldStopRecurring({ runsCompleted: 2, repeatCount: 5 }), false);
});
