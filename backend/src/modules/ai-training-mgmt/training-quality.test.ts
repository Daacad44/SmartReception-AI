import assert from 'node:assert/strict';
import test from 'node:test';
import { isNoKnowledgeAnswer, NO_KNOWLEDGE_REPLY } from './ai-knowledge.constants';
import { calculateQualityScores, type TrainingSnapshot } from './quality.service';

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
