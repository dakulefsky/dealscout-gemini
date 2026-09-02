const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('existing approved deal remains approved during rediscovery', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'APPROVED', is_expired: 0 }, 'PENDING_REVIEW'), {});
});
