const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('manual rejection cannot be silently undone by rediscovery', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'REJECTED', is_expired: 0 }, 'APPROVED'), {});
});
