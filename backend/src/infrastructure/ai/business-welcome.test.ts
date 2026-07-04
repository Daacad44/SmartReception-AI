import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSmartReceptionStoredContent } from './smartreception-tenant';
import {
  isGenericEnglishGreeting,
  isPredominantlyEnglish,
} from './business-language.util';

test('detects English Botandev company intro as predominantly English', () => {
  const intro =
    'Botandev is a Somali company specializing in Software Engineering and AI Solutions.';
  assert.equal(isPredominantlyEnglish(intro), true);
});

test('detects generic English greeting', () => {
  assert.equal(isGenericEnglishGreeting('Hello! How can I help you today?'), true);
  assert.equal(isGenericEnglishGreeting('Ku soo dhawoow SmartReception AI.'), false);
});

test('custom tenant greeting is not treated as SmartReception content', () => {
  const greeting =
    'Ku soo dhawoow Botan Dev.\n\nWaxaan nahay shirkad bixisa adeegyada AI Automation.';
  assert.equal(isSmartReceptionStoredContent(greeting), false);
});

test('SmartReception platform greeting is detected as platform content', () => {
  assert.equal(isSmartReceptionStoredContent('Ku soo dhawoow SmartReception AI.'), true);
});
