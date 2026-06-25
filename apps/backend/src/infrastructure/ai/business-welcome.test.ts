import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSmartReceptionStoredContent } from './smartreception-tenant';

test('custom tenant greeting is not treated as SmartReception content', () => {
  const greeting =
    'Ku soo dhawoow Botan Dev.\n\nWaxaan nahay shirkad bixisa adeegyada AI Automation.';
  assert.equal(isSmartReceptionStoredContent(greeting), false);
});

test('SmartReception platform greeting is detected as platform content', () => {
  assert.equal(isSmartReceptionStoredContent('Ku soo dhawoow SmartReception AI.'), true);
});
