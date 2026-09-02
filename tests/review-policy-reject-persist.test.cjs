const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('manual rejection is not auto-approved later', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'REJECTED' }, 'APPROVED'), {});
});
