import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGeminiAiResponse } from './gemini-json-parse';
import { parseMenuSelection } from './somali-menu';

test('parseGeminiAiResponse parses valid JSON', () => {
  const result = parseGeminiAiResponse(
    '{"content":"Haa, fadlan ii sheeg su\'aal","intent":"general","actions":[{"type":"none"}],"confidence":0.8,"language":"so"}',
    'so'
  );
  assert.equal(result?.content, "Haa, fadlan ii sheeg su'aal");
});

test('parseGeminiAiResponse extracts content from truncated JSON', () => {
  const result = parseGeminiAiResponse('{ "content": "Haa, fadlan ii sheeg su\'a', 'so');
  assert.equal(result?.content, "Haa, fadlan ii sheeg su'a");
});

test('parseGeminiAiResponse never returns raw JSON payload', () => {
  const result = parseGeminiAiResponse('{ "content": "Haa, fadlan ii sheeg su\'a', 'so');
  assert.notEqual(result?.content.trim().startsWith('{'), true);
});

test('parseGeminiAiResponse strips markdown fences', () => {
  const result = parseGeminiAiResponse(
    '```json\n{"content":"Waa la helay","intent":"general","actions":[{"type":"none"}]}\n```',
    'so'
  );
  assert.equal(result?.content, 'Waa la helay');
});

test('parseMenuSelection keyword match is optional for tenant menus', () => {
  assert.equal(parseMenuSelection('android'), 6);
  assert.equal(parseMenuSelection('android', { keywordMatch: false }), null);
});
