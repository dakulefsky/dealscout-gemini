const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('approved product is not demoted into review by rediscovery', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'APPROVED' }, 'PENDING_REVIEW'), {});
});
