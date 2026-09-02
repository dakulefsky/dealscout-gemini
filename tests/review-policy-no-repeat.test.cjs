const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('same rejected product is not requeued by normal rediscovery', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'REJECTED' }, 'PENDING_REVIEW'), {});
});
