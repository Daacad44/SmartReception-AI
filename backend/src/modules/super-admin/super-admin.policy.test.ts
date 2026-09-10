import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLastSuperAdminChangeBlocked } from './super-admin.policy';

test('last super admin cannot be demoted or deactivated', () => {
  assert.equal(
    isLastSuperAdminChangeBlocked({
      targetIsSuperAdmin: true,
      activeSuperAdminCount: 1,
      nextIsSuperAdmin: false,
    }),
    true
  );
  assert.equal(
    isLastSuperAdminChangeBlocked({
      targetIsSuperAdmin: true,
      activeSuperAdminCount: 1,
      nextIsActive: false,
    }),
    true
  );
  assert.equal(
    isLastSuperAdminChangeBlocked({
      targetIsSuperAdmin: true,
      activeSuperAdminCount: 2,
      nextIsSuperAdmin: false,
    }),
    false
  );
  assert.equal(
    isLastSuperAdminChangeBlocked({
      targetIsSuperAdmin: false,
      activeSuperAdminCount: 1,
      nextIsActive: false,
    }),
    false
  );
});
