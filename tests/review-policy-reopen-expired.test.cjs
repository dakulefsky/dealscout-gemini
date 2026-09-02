const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('expiration remains revivable independently of manual rejection', () => {
  const result = rediscoveryLifecycleChanges({ status: 'EXPIRED', is_expired: true }, 'APPROVED');
  assert.equal(result.status, 'APPROVED');
  assert.equal(result.is_expired, 0);
});
