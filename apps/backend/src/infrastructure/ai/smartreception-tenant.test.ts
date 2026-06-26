import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultGreetingMessage,
  buildDefaultSystemPrompt,
  isSmartReceptionBusiness,
  isSmartReceptionStoredContent,
} from './smartreception-tenant';

test('isSmartReceptionBusiness detects platform workspace by slug', () => {
  assert.equal(
    isSmartReceptionBusiness({ id: '1', slug: 'smartreception', name: 'Botan Dev' }),
    true
  );
  assert.equal(
    isSmartReceptionBusiness({ id: '2', slug: 'botan-developer', name: 'Botan Dev' }),
    false
  );
  assert.equal(
    isSmartReceptionBusiness({ id: '3', slug: 'botan-dev', name: 'SmartReception AI' }),
    false
  );
});

test('isSmartReceptionBusiness does not match by business name alone', () => {
  assert.equal(
    isSmartReceptionBusiness({ id: '4', slug: 'platform', name: 'SmartReception AI' }),
    false
  );
});

test('isSmartReceptionStoredContent detects seeded SmartReception copy', () => {
  assert.equal(
    isSmartReceptionStoredContent('Ku soo dhawoow SmartReception AI.'),
    true
  );
  assert.equal(
    isSmartReceptionStoredContent('Ku soo dhawoow Botan Dev.'),
    false
  );
});

test('buildDefaultGreetingMessage uses business name', () => {
  const greeting = buildDefaultGreetingMessage('Botan Dev');
  assert.match(greeting, /Botan Dev/);
  assert.doesNotMatch(greeting, /SmartReception/);
});

test('buildDefaultSystemPrompt scopes assistant to business', () => {
  const prompt = buildDefaultSystemPrompt('Jaziira Restaurant');
  assert.match(prompt, /Jaziira Restaurant/);
  assert.doesNotMatch(prompt, /SmartReception/);
});
