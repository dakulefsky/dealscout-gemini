const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('rejected status is not overwritten by later automatic approval', () => {
  const changes = rediscoveryLifecycleChanges({ status: 'REJECTED', is_expired: false }, 'APPROVED');
  assert.equal(Object.prototype.hasOwnProperty.call(changes, 'status'), false);
});
