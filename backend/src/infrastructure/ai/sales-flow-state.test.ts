import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveActiveSalesFlowFromMessages } from './sales-flow-state';
import type { SalesFlowState } from './sales-flow.types';
import { getMenuOptionContent } from './somali-menu';

function flow(overrides: Partial<SalesFlowState> = {}): SalesFlowState {
  return {
    serviceOption: 1,
    serviceName: 'AI Receptionist',
    phase: 'appointment_collect',
    questionIndex: 4,
    questionKeys: ['apptTime'],
    answers: {},
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

test('fresh service menu takes priority over older incomplete sales flow', () => {
  const state = resolveActiveSalesFlowFromMessages([
    { metadata: { type: 'service_menu', language: 'so' } },
    { metadata: { type: 'sales_flow', salesFlow: flow() } },
  ]);
  assert.equal(state, null);
});

test('static menu_option reply also ends a sticky sales flow', () => {
  const state = resolveActiveSalesFlowFromMessages([
    { metadata: { type: 'menu_option', option: 8 } },
    { metadata: { type: 'sales_flow', salesFlow: flow() } },
  ]);
  assert.equal(state, null);
});

test('completed sales flow does not fall through to an older incomplete flow', () => {
  const state = resolveActiveSalesFlowFromMessages([
    { metadata: { type: 'sales_flow', salesFlow: flow({ phase: 'completed' }) } },
    { metadata: { type: 'sales_flow', salesFlow: flow({ phase: 'appointment_collect' }) } },
  ]);
  assert.equal(state, null);
});

test('newest incomplete sales flow is still active when no menu was sent', () => {
  const active = flow({ phase: 'questions' });
  const state = resolveActiveSalesFlowFromMessages([
    { metadata: { type: 'sales_flow', salesFlow: active } },
    { metadata: { type: 'sales_flow', salesFlow: flow({ phase: 'completed' }) } },
  ]);
  assert.equal(state?.phase, 'questions');
});

test('menu option 8 static pricing copy does not start the sales questionnaire', () => {
  const content = getMenuOptionContent(8);
  assert.ok(content);
  assert.match(content, /Qiimaha Adeegyada/);
  assert.doesNotMatch(content, /Smart Sales Consultant/);
  assert.doesNotMatch(content, /Magacaaga\?/);
});
