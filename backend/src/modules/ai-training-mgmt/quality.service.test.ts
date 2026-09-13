import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSnapshotDocument,
  calculateQualityScores,
  describeReadinessGaps,
  documentHasVectors,
  readinessStatus,
  type TrainingSnapshot,
} from './quality.service';

function snapshot(overrides: Partial<TrainingSnapshot> = {}): TrainingSnapshot {
  return {
    profile: {
      businessName: 'Jazeera',
      phone: '123',
    },
    documents: [],
    faqCount: 0,
    indexedCount: 0,
    embeddingCount: 0,
    totalChunks: 0,
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AI readiness quality scores', () => {
  it('does not treat embedding JSON without vectors as quality embeddings', () => {
    const fake = JSON.stringify({
      chunks: [{ text: 'hello', embedding: null }],
      chunkCount: 1,
      vectorSearchEnabled: false,
    });
    assert.equal(documentHasVectors(fake), false);
    const scores = calculateQualityScores(
      snapshot({
        documents: [
          buildSnapshotDocument({
            id: '1',
            title: 'Sales report',
            type: 'PDF',
            status: 'INDEXED',
            content: 'sales',
            question: null,
            answer: null,
            embedding: fake,
          }),
        ],
        indexedCount: 1,
        embeddingCount: 1,
        totalChunks: 1,
      })
    );
    assert.equal(scores.embeddingQuality, 0);
    assert.ok(scores.readinessScore < 40);
    assert.equal(readinessStatus(scores.readinessScore), 'critical');
  });

  it('reports incomplete profile and missing FAQs as the degraded gaps', () => {
    const withVectors = JSON.stringify({
      chunks: [{ text: 'menu', embedding: Array(8).fill(0.1) }],
      chunkCount: 1,
      vectorSearchEnabled: true,
    });
    const snap = snapshot({
      documents: [
        buildSnapshotDocument({
          id: '1',
          title: 'Menu',
          type: 'PDF',
          status: 'INDEXED',
          content: 'menu',
          question: null,
          answer: null,
          embedding: withVectors,
        }),
      ],
      indexedCount: 1,
      embeddingCount: 1,
      totalChunks: 1,
    });
    const scores = calculateQualityScores(snap);
    const gaps = describeReadinessGaps(snap, scores);
    assert.ok(gaps.some((g) => g.code === 'INCOMPLETE_PROFILE'));
    assert.ok(gaps.some((g) => g.code === 'MISSING_FAQS'));
    assert.equal(
      gaps.some((g) => g.code === 'MISSING_EMBEDDINGS'),
      false
    );
  });
});
