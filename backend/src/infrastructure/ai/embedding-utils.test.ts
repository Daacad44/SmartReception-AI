import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countEmbeddedChunks,
  hasUsableDocumentEmbedding,
} from './embedding-utils';

describe('hasUsableDocumentEmbedding', () => {
  it('returns false for missing or invalid JSON', () => {
    assert.equal(hasUsableDocumentEmbedding(null), false);
    assert.equal(hasUsableDocumentEmbedding('not-json'), false);
  });

  it('returns false when vectors are null even if the document is marked indexed', () => {
    assert.equal(
      hasUsableDocumentEmbedding(
        JSON.stringify({ vectorSearchEnabled: false, chunks: [{ text: 'hi', embedding: null }] })
      ),
      false
    );
  });

  it('returns true when at least one chunk has a vector', () => {
    assert.equal(
      hasUsableDocumentEmbedding(
        JSON.stringify({
          vectorSearchEnabled: true,
          chunks: [{ text: 'hi', embedding: [0.1, 0.2, 0.3] }],
        })
      ),
      true
    );
    assert.equal(countEmbeddedChunks(JSON.stringify({ chunks: [{ embedding: [1] }, { embedding: null }] })), 1);
  });
});
