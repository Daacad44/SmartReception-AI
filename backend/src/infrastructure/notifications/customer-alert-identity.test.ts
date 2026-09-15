import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAlertPhone,
  formatCustomerAlertIdentity,
} from './customer-alert-identity';

describe('formatAlertPhone', () => {
  it('formats a canonical Somali mobile with grouping', () => {
    assert.equal(formatAlertPhone('+252612345678'), '+252 61 2345678');
    assert.equal(formatAlertPhone('0612345678'), '+252 61 2345678');
  });

  it('leaves non-Somali numbers unchanged', () => {
    assert.equal(formatAlertPhone('+14155552671'), '+14155552671');
  });

  it('returns empty for missing values', () => {
    assert.equal(formatAlertPhone(null), '');
    assert.equal(formatAlertPhone('  '), '');
  });
});

describe('formatCustomerAlertIdentity', () => {
  it('joins name and phone', () => {
    assert.equal(
      formatCustomerAlertIdentity('Ahmed', '+252612345678'),
      'Ahmed · +252 61 2345678'
    );
  });

  it('shows only phone when the name is the same number', () => {
    assert.equal(
      formatCustomerAlertIdentity('+252612345678', '+252612345678'),
      '+252 61 2345678'
    );
    assert.equal(formatCustomerAlertIdentity('0612345678', '+252612345678'), '+252 61 2345678');
  });

  it('shows only name when phone is missing', () => {
    assert.equal(formatCustomerAlertIdentity('Ahmed', null), 'Ahmed');
  });

  it('shows only phone when name is missing', () => {
    assert.equal(formatCustomerAlertIdentity('', '+252612345678'), '+252 61 2345678');
  });

  it('falls back when both are missing', () => {
    assert.equal(formatCustomerAlertIdentity(null, null), 'Unknown customer');
  });
});
