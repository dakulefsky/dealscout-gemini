const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('rejected status survives clean rediscovery', () => {
  const changes = rediscoveryLifecycleChanges({ status: 'REJECTED', is_expired: 0 }, 'APPROVED');
  assert.deepEqual(changes, {});
});
