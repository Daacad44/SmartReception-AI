import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasUnsupportedFactualClaims,
  isNoKnowledgeAnswer,
  NO_KNOWLEDGE_REPLY,
} from './ai-knowledge.constants';
import { assessTrainingSnapshot, calculateQualityScores, type TrainingSnapshot } from './quality.service';

test('quality scoring credits approved structured business services', () => {
  const snapshot: TrainingSnapshot = {
    profile: { businessName: 'Example Business' },
    documents: [{
      id: 'doc-1',
      title: 'About us',
      type: 'TEXT',
      status: 'INDEXED',
      content: 'Approved business information',
      question: null,
      answer: null,
      embedding: '{"chunkCount":1}',
      chunkCount: 1,
    }],
    faqCount: 0,
    indexedCount: 1,
    embeddingCount: 1,
    totalChunks: 1,
    capturedAt: '2026-10-09T00:00:00.000Z',
  };

  const withoutServices = calculateQualityScores(snapshot);
  const withServices = calculateQualityScores({ ...snapshot, serviceCount: 7 });
  assert.ok(withServices.knowledgeCoverage > withoutServices.knowledgeCoverage);
  assert.ok(withServices.readinessScore > withoutServices.readinessScore);
});

test('canonical handover reply is recognized as a safe no-knowledge answer', () => {
  assert.equal(isNoKnowledgeAnswer(NO_KNOWLEDGE_REPLY), true);
  assert.equal(isNoKnowledgeAnswer('A made-up confident answer'), false);
});

test('multilingual paraphrases are safe while invented factual tokens are blocked', () => {
  const context = 'Qiimaha adeeggu waa $25. Nala soo xiriir support@example.com.';
  assert.equal(
    hasUnsupportedFactualClaims('The service is available; contact support@example.com.', context),
    false
  );
  assert.equal(hasUnsupportedFactualClaims('The service costs $99.', context), true);
  assert.equal(hasUnsupportedFactualClaims(NO_KNOWLEDGE_REPLY, context), false);
});

test('a complete professional knowledge base can reach 100% without document-volume gaming', () => {
  const assessment = assessTrainingSnapshot({
    profile: {
      businessName: 'Example Business',
      businessDescription: 'A verified description of the business and its customer promise.',
      businessCategory: 'Professional services',
      targetAudience: 'Local business customers',
      workingHours: 'Monday-Friday 09:00-17:00',
      languages: ['so', 'en'],
      brandTone: 'Professional',
      email: 'support@example.com',
      city: 'Mogadishu',
      whyChooseUs: 'Verified, responsive customer service',
    },
    documents: [{
      id: 'doc-complete',
      title: 'Approved business handbook',
      type: 'TEXT',
      status: 'INDEXED',
      content: 'This approved handbook contains complete and verified operational facts for customer support and service delivery.',
      question: null,
      answer: null,
      embedding: '{"chunkCount":1}',
      chunkCount: 1,
      updatedAt: '2026-10-09T00:00:00.000Z',
    }],
    faqCount: 1,
    indexedCount: 1,
    embeddingCount: 1,
    totalChunks: 1,
    serviceCount: 1,
    productCount: 0,
    capturedAt: '2026-10-09T00:00:00.000Z',
  });

  assert.equal(assessment.scores.knowledgeScore, 100);
  assert.equal(assessment.scores.confidenceScore, 100);
  assert.equal(assessment.scores.readinessScore, 100);
  assert.deepEqual(assessment.gaps, []);
});
