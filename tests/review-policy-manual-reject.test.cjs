const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('manual reject is a durable editorial decision', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'REJECTED', is_expired: 0 }, 'PENDING_REVIEW'), {});
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'REJECTED', is_expired: 0 }, 'APPROVED'), {});
});
