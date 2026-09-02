const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('expired deal can return when it becomes a valid deal again', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'EXPIRED', is_expired: 1 }, 'APPROVED'), { is_expired: 0, expired_at: null, status: 'APPROVED' });
});
