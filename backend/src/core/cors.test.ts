import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllowedOrigins,
  isOriginAllowed,
  parseCorsOrigins,
  type CorsRuntimeConfig,
} from './cors';

const productionConfig: CorsRuntimeConfig = {
  frontendUrl: 'https://somreception.com',
  extraOrigins: [],
  env: 'production',
};

describe('parseCorsOrigins', () => {
  it('splits comma-separated origins and strips trailing slashes', () => {
    assert.deepEqual(parseCorsOrigins('https://a.example/ , https://b.example'), [
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('returns an empty list for missing input', () => {
    assert.deepEqual(parseCorsOrigins(undefined), []);
  });
});

describe('getAllowedOrigins', () => {
  it('always includes the production frontend origin', () => {
    const origins = getAllowedOrigins(productionConfig);
    assert.equal(origins.includes('https://somreception.com'), true);
    assert.equal(origins.includes('https://www.somreception.com'), true);
    assert.equal(origins.includes('https://somreception.botandev.com'), true);
  });

  it('includes FRONTEND_URL and CORS_ORIGINS extras', () => {
    const origins = getAllowedOrigins({
      ...productionConfig,
      frontendUrl: 'https://custom.example',
      extraOrigins: ['https://preview.example'],
    });
    assert.equal(origins.includes('https://custom.example'), true);
    assert.equal(origins.includes('https://preview.example'), true);
  });

  it('does not add localhost in production', () => {
    const origins = getAllowedOrigins(productionConfig);
    assert.equal(origins.some((origin) => origin.includes('localhost')), false);
  });
});

describe('isOriginAllowed', () => {
  it('allows the production SomReception origin', () => {
    assert.equal(isOriginAllowed('https://somreception.com', productionConfig), true);
  });

  it('allows missing Origin (server-to-server / curl)', () => {
    assert.equal(isOriginAllowed(undefined, productionConfig), true);
  });

  it('rejects unknown origins in production', () => {
    assert.equal(isOriginAllowed('https://evil.example', productionConfig), false);
  });

  it('allows Vercel preview origins', () => {
    assert.equal(
      isOriginAllowed('https://smartreception-git-main-team.vercel.app', productionConfig),
      true
    );
  });

  it('allows unknown origins outside production', () => {
    assert.equal(
      isOriginAllowed('http://localhost:9999', { ...productionConfig, env: 'development' }),
      true
    );
  });
});
