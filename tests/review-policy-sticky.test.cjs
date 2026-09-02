const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('same rejected ASIN does not return to owner on ordinary rediscovery', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'REJECTED', is_expired: false }, 'PENDING_REVIEW'), {});
});
