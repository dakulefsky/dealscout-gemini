const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('manual rejection stays rejected when same ASIN is rediscovered', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'REJECTED', is_expired: 0 }, 'APPROVED'), {});
});

test('pending deal can still become approved automatically', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'PENDING_REVIEW', is_expired: 0 }, 'APPROVED'), { status: 'APPROVED' });
});
