import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findMetaTemplateOnWaba,
  formatMetaTemplateValidationError,
  type MetaMessageTemplate,
} from './whatsapp-meta-templates.service';

const templates: MetaMessageTemplate[] = [
  { name: 'hello_world', language: 'en_US', status: 'APPROVED' },
  { name: 'smartreception_welcome', language: 'en', status: 'APPROVED' },
  { name: 'pending_template', language: 'en', status: 'PENDING' },
];

describe('findMetaTemplateOnWaba', () => {
  it('finds exact name and language', () => {
    const result = findMetaTemplateOnWaba(templates, 'smartreception_welcome', 'en');
    assert.equal(result.found, true);
    assert.equal(result.match?.language, 'en');
  });

  it('reports missing template on WABA', () => {
    const result = findMetaTemplateOnWaba(templates, 'missing_template', 'en');
    assert.equal(result.found, false);
    assert.equal(result.approvedOnWaba, false);
  });

  it('matches language prefix when en is requested for en_US template', () => {
    const result = findMetaTemplateOnWaba(templates, 'hello_world', 'en');
    assert.equal(result.found, true);
    assert.equal(result.match?.language, 'en_US');
  });
});

describe('formatMetaTemplateValidationError', () => {
  it('explains WABA mismatch clearly', () => {
    const message = formatMetaTemplateValidationError({
      templateName: 'smartreception_welcome',
      templateLanguage: 'en',
      wabaId: '1559594135782925',
      lookup: { found: false, approvedOnWaba: false },
      approvedTemplates: templates,
    });

    assert.match(message, /not registered on your connected WhatsApp Business Account/);
    assert.match(message, /hello_world \(en_US\)/);
  });
});
