import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BusinessProfile } from '@prisma/client';
import {
  PROFILE_COMPLETENESS_TOTAL,
  calculateQualityScores,
  profileCompletenessHits,
  readinessStatus,
  type TrainingSnapshot,
} from './quality.service';

function snapshot(overrides: Partial<TrainingSnapshot> = {}): TrainingSnapshot {
  return {
    profile: null,
    documents: [],
    faqCount: 0,
    indexedCount: 0,
    embeddingCount: 0,
    totalChunks: 0,
    productCount: 0,
    serviceCount: 0,
    hasPricing: false,
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AI readiness calculation', () => {
  it('treats aliased BusinessProfile columns as filled', () => {
    const profile = {
      businessName: 'Jazeera Restaurant',
      businessDescription: 'Somali restaurant',
      mission: 'Serve guests',
      vision: 'Grow',
      workingHours: '9-5',
      languages: ['so', 'en'],
      targetAudience: 'Families',
      whyChooseUs: 'Fresh food',
      city: 'Mogadishu',
      email: 'hello@example.com',
      phone: '+252600000000',
      website: 'https://example.com',
      brandTone: 'warm',
    } as unknown as Partial<BusinessProfile>;

    const hits = profileCompletenessHits(
      snapshot({
        profile,
        faqCount: 1,
        serviceCount: 3,
        productCount: 1,
        hasPricing: true,
      })
    );
    assert.equal(hits, PROFILE_COMPLETENESS_TOTAL);
  });

  it('does not score phantom fields that are not on BusinessProfile', () => {
    const profile = {
      businessName: 'Cafe',
      description: 'this column does not exist',
      contactEmail: 'ignored@example.com',
      contactPhone: '000',
      products: 'ignored',
      services: 'ignored',
      pricing: 'ignored',
      supportPolicy: 'ignored',
      refundPolicy: 'ignored',
      cancellationPolicy: 'ignored',
      faqs: 'ignored',
    } as unknown as Partial<BusinessProfile>;

    const hits = profileCompletenessHits(snapshot({ profile }));
    assert.equal(hits, 1);
  });

  it('marks 60% as degraded and does not hardcode 100%', () => {
    assert.equal(readinessStatus(60), 'degraded');
    assert.equal(readinessStatus(70), 'healthy');
    assert.equal(readinessStatus(39), 'critical');
  });

  it('scores a single indexed document from real snapshot state', () => {
    const scores = calculateQualityScores(
      snapshot({
        profile: { businessName: 'Cafe' } as Partial<BusinessProfile>,
        documents: [
          {
            id: 'doc-1',
            title: 'Menu',
            type: 'PDF',
            status: 'INDEXED',
            content: 'sambusa',
            question: null,
            answer: null,
            embedding: '{"chunkCount":8}',
            chunkCount: 8,
          },
        ],
        indexedCount: 1,
        embeddingCount: 1,
        totalChunks: 8,
      })
    );
    assert.ok(scores.readinessScore > 0);
    assert.ok(scores.readinessScore < 100);
    assert.equal(scores.embeddingQuality, 100);
    assert.equal(scores.knowledgeCoverage, 49);
  });
});
