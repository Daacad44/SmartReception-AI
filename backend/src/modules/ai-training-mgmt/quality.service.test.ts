import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshotDocument, calculateQualityScores, type TrainingSnapshot } from './quality.service';

function snapshot(overrides: Partial<TrainingSnapshot> = {}): TrainingSnapshot {
  return {
    profile: {
      businessName: 'Jazeera Restaurant',
      businessDescription: 'Somali restaurant',
      companyOverview: 'Daily meals',
      workingHours: '8am-10pm',
      email: 'info@example.com',
      phone: '252611111111',
      website: 'https://example.com',
      brandTone: 'friendly',
      languages: ['so', 'en'],
      mission: 'Serve great food',
      vision: 'Best restaurant in Mogadishu',
    },
    documents: [
      buildSnapshotDocument({
        id: 'doc-1',
        title: 'Daily sales',
        type: 'PDF',
        status: 'INDEXED',
        content: 'Mohamett Hashi 557.72',
        question: null,
        answer: null,
        embedding: JSON.stringify({ chunkCount: 4, chunks: ['a', 'b', 'c', 'd'] }),
        chunkCount: 4,
        embeddedChunkCount: 4,
      }),
    ],
    faqCount: 0,
    indexedCount: 1,
    embeddingCount: 4,
    totalChunks: 4,
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AI readiness quality scores', () => {
  it('counts real BusinessProfile fields, not legacy aliases', () => {
    const scores = calculateQualityScores(snapshot());
    assert.ok(scores.knowledgeCompleteness >= 50, `completeness was ${scores.knowledgeCompleteness}`);
    assert.equal(scores.embeddingQuality, 100);
    assert.ok(scores.readinessScore > 0);
    assert.ok(scores.readinessScore <= 100);
  });

  it('does not treat an empty profile as complete', () => {
    const scores = calculateQualityScores(
      snapshot({
        profile: {},
      })
    );
    assert.equal(scores.knowledgeCompleteness, 0);
  });

  it('counts chunk embeddings when document.embedding is empty', () => {
    const scores = calculateQualityScores(
      snapshot({
        documents: [
          buildSnapshotDocument({
            id: 'doc-1',
            title: 'Menu',
            type: 'PDF',
            status: 'INDEXED',
            content: 'halal chicken',
            question: null,
            answer: null,
            embedding: null,
            chunkCount: 6,
            embeddedChunkCount: 6,
          }),
        ],
        embeddingCount: 6,
        totalChunks: 6,
      })
    );
    assert.equal(scores.embeddingQuality, 100);
  });

  it('does not hardcode readiness to 100', () => {
    const sparse = calculateQualityScores(
      snapshot({
        profile: { businessName: 'A' },
        documents: [],
        indexedCount: 0,
        embeddingCount: 0,
        totalChunks: 0,
        faqCount: 0,
      })
    );
    assert.ok(sparse.readinessScore < 100);
    assert.ok(sparse.knowledgeCoverage < 40);
  });
});
