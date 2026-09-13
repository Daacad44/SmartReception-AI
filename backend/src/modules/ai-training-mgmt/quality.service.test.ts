import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateQualityScores, describeReadiness, type TrainingSnapshot } from './quality.service';

function snapshot(overrides: Partial<TrainingSnapshot> = {}): TrainingSnapshot {
  return {
    profile: {
      businessName: 'Jazira Restaurant',
      businessDescription: 'Somali restaurant',
      mission: 'Serve great food',
      vision: 'Grow',
      workingHours: '9-10',
      languages: ['so', 'en'],
      brandTone: 'friendly',
      website: 'https://example.com',
      email: 'info@example.com',
      phone: '2526',
      supportEmail: 'help@example.com',
      whatsapp: '2526',
      address: 'Mogadishu',
      whyChooseUs: 'Quality',
      targetAudience: 'Families',
      callToAction: 'Book a table',
    },
    documents: [
      {
        id: 'd1',
        title: 'Menu',
        type: 'PDF',
        status: 'INDEXED',
        content: 'canjeero',
        question: null,
        answer: null,
        embedding: JSON.stringify({
          vectorSearchEnabled: true,
          chunkCount: 2,
          chunks: [
            { text: 'canjeero', embedding: [0.1, 0.2] },
            { text: 'hilib', embedding: [0.2, 0.1] },
          ],
        }),
        chunkCount: 2,
      },
    ],
    faqCount: 2,
    indexedCount: 1,
    embeddingCount: 1,
    totalChunks: 2,
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('calculateQualityScores', () => {
  it('does not treat a JSON blob without vectors as high embedding quality', () => {
    const scores = calculateQualityScores(
      snapshot({
        documents: [
          {
            id: 'd1',
            title: 'Menu',
            type: 'PDF',
            status: 'INDEXED',
            content: 'x',
            question: null,
            answer: null,
            embedding: JSON.stringify({ vectorSearchEnabled: false, chunks: [{ text: 'x', embedding: null }] }),
            chunkCount: 1,
          },
        ],
        embeddingCount: 0,
        faqCount: 0,
      })
    );
    assert.equal(scores.embeddingQuality, 0);
  });

  it('scores a complete profile with embeddings and FAQs as healthy', () => {
    const scores = calculateQualityScores(snapshot());
    const breakdown = describeReadiness(scores, snapshot());
    assert.ok(scores.knowledgeCompleteness >= 90, `completeness ${scores.knowledgeCompleteness}`);
    assert.ok(scores.readinessScore >= 70, `readiness ${scores.readinessScore}`);
    assert.equal(breakdown.status, 'healthy');
    assert.ok(breakdown.checks.every((c) => c.passed));
  });

  it('uses real BusinessProfile field names rather than stale aliases', () => {
    const incomplete = calculateQualityScores(
      snapshot({
        profile: { businessName: 'Only name' },
        faqCount: 0,
      })
    );
    assert.ok(incomplete.knowledgeCompleteness < 20);
    assert.ok(incomplete.readinessScore < 70);
  });
});
