const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('human reject cannot be silently undone by provider rediscovery', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'REJECTED' }, 'APPROVED'), {});
});
