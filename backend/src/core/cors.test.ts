import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllowedOrigins, isOriginAllowed } from './cors';

describe('CORS allowlist', () => {
  it('allows the production dashboard origin', () => {
    assert.equal(isOriginAllowed('https://somreception.com', 'production'), true);
    assert.equal(isOriginAllowed('https://www.somreception.com', 'production'), true);
  });

  it('allows the legacy Botan Dev frontend origin', () => {
    assert.equal(isOriginAllowed('https://somreception.botandev.com', 'production'), true);
  });

  it('rejects unknown origins in production', () => {
    assert.equal(isOriginAllowed('https://evil.example', 'production'), false);
  });

  it('allows requests with no Origin (non-browser)', () => {
    assert.equal(isOriginAllowed(undefined, 'production'), true);
  });

  it('allows localhost only outside production', () => {
    assert.equal(isOriginAllowed('http://localhost:5173', 'development'), true);
    assert.equal(isOriginAllowed('http://localhost:5173', 'production'), false);
  });

  it('never includes a wildcard origin', () => {
    assert.equal(getAllowedOrigins('production').includes('*'), false);
  });
});
