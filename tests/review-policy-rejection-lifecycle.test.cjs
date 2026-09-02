const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('rejected record is not promoted by rediscovery lifecycle', () => {
  assert.equal(rediscoveryLifecycleChanges({ status: 'REJECTED' }, 'APPROVED').status, undefined);
});
