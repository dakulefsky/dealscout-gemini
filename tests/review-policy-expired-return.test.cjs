const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('expired product may return when rediscovered as valid', () => {
  const result = rediscoveryLifecycleChanges({ status: 'EXPIRED', is_expired: 1 }, 'APPROVED');
  assert.equal(result.status, 'APPROVED');
});
