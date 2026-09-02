const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('rediscovery may refresh rejected record data without changing editorial status', () => {
  const lifecycle = rediscoveryLifecycleChanges({ status: 'REJECTED', is_expired: 0 }, 'APPROVED');
  assert.deepEqual(lifecycle, {});
});
