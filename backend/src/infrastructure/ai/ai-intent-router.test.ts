import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAiResourceRoute,
  isCompanyIdentityQuery,
} from './ai-intent-router.service';

test('first customer message routes to business profile', () => {
  assert.equal(
    classifyAiResourceRoute('How much does CRM cost?', { isFirstCustomerMessage: true }),
    'business_profile'
  );
});

test('company identity questions route to business profile', () => {
  assert.equal(
    classifyAiResourceRoute('Who are you?', { isFirstCustomerMessage: false }),
    'business_profile'
  );
  assert.equal(
    classifyAiResourceRoute('Tell me about your company', { isFirstCustomerMessage: false }),
    'business_profile'
  );
  assert.equal(
    classifyAiResourceRoute('Waa maxay website-kaaga?', { isFirstCustomerMessage: false }),
    'business_profile'
  );
});

test('operational questions route to knowledge base', () => {
  assert.equal(
    classifyAiResourceRoute('How much does the premium plan cost?', { isFirstCustomerMessage: false }),
    'knowledge_base'
  );
  assert.equal(
    classifyAiResourceRoute('How do I book an appointment?', { isFirstCustomerMessage: false }),
    'knowledge_base'
  );
});

test('isCompanyIdentityQuery detects contact and about questions', () => {
  assert.equal(isCompanyIdentityQuery('What is your mission?'), true);
  assert.equal(isCompanyIdentityQuery('How much does premium plan cost?'), false);
});
