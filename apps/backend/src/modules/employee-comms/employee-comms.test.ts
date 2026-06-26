import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personalizeEmployeeMessage } from './employee-personalization.service';

test('personalizeEmployeeMessage replaces employee and business variables', () => {
  const result = personalizeEmployeeMessage(
    'Hello {{employee_name}} from {{business_name}} — {{department}}',
    {
      businessName: 'Botan Dev',
      employee: {
        fullName: 'Ahmed Hassan',
        jobTitle: 'Sales Lead',
        department: 'Sales',
        branch: 'Mogadishu',
        email: 'ahmed@botan.dev',
        phone: '252611111111',
      },
    }
  );
  assert.match(result, /Ahmed Hassan/);
  assert.match(result, /Botan Dev/);
  assert.match(result, /Sales/);
  assert.doesNotMatch(result, /\{\{/);
});

test('personalizeEmployeeMessage leaves unknown placeholders intact', () => {
  const result = personalizeEmployeeMessage('Hi {{employee_name}}, code {{unknown_var}}', {
    businessName: 'Test Co',
    employee: {
      fullName: 'Sara',
      jobTitle: null,
      department: null,
      branch: null,
      email: null,
      phone: '252622222222',
    },
  });
  assert.match(result, /Sara/);
  assert.match(result, /\{\{unknown_var\}\}/);
});
