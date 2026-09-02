const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('verified rediscovery reactivates an expired deal', () => {
  assert.deepEqual(
    rediscoveryLifecycleChanges({ status: 'EXPIRED', is_expired: 1, expired_at: 123 }, 'APPROVED'),
    { is_expired: 0, expired_at: null, status: 'APPROVED' }
  );
});

test('verified rediscovery can return an expired deal to review', () => {
  assert.deepEqual(
    rediscoveryLifecycleChanges({ status: 'EXPIRED', is_expired: 1 }, 'PENDING_REVIEW'),
    { is_expired: 0, expired_at: null, status: 'PENDING_REVIEW' }
  );
});

test('nonexpired approved deals are not downgraded by rediscovery', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'APPROVED', is_expired: 0 }, 'PENDING_REVIEW'), {});
});

test('nonexpired pending deals may be promoted when rediscovered as approvable', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'PENDING_REVIEW', is_expired: 0 }, 'APPROVED'), { status: 'APPROVED' });
});

test('manual rejection is sticky across normal rediscovery', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'REJECTED', is_expired: 0 }, 'APPROVED'), {});
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'REJECTED', is_expired: 0 }, 'PENDING_REVIEW'), {});
});
