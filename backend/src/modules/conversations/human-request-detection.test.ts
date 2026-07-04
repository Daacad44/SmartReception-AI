import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectHumanHandoffRequest,
  parseFeedbackResponse,
} from './human-request-detection.service';

describe('detectHumanHandoffRequest', () => {
  it('detects English human requests', () => {
    assert.equal(detectHumanHandoffRequest('I want to speak with someone'), true);
    assert.equal(detectHumanHandoffRequest('Transfer me to support'), true);
    assert.equal(detectHumanHandoffRequest('support'), true);
  });

  it('detects Somali human requests', () => {
    assert.equal(detectHumanHandoffRequest('Waxaan rabaa qof'), true);
    assert.equal(detectHumanHandoffRequest('Shaqaale ayaan rabaa'), true);
    assert.equal(detectHumanHandoffRequest('Ma doonayo AI'), true);
    assert.equal(detectHumanHandoffRequest('bani adam rabaa'), true);
    assert.equal(detectHumanHandoffRequest('Waxaan rabaa bini aadam'), true);
  });

  it('ignores normal messages', () => {
    assert.equal(detectHumanHandoffRequest('What are your opening hours?'), false);
  });
});

describe('parseFeedbackResponse', () => {
  it('parses yes/no/human choices', () => {
    assert.equal(parseFeedbackResponse('✅ Yes'), 'yes');
    assert.equal(parseFeedbackResponse('❌ No'), 'no');
    assert.equal(parseFeedbackResponse('👤 Talk to Human'), 'human');
    assert.equal(parseFeedbackResponse('Haa'), 'yes');
    assert.equal(parseFeedbackResponse('Maya'), 'no');
  });
});
