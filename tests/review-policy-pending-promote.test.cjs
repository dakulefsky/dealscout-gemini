const test = require('node:test');
const assert = require('node:assert/strict');
const { rediscoveryLifecycleChanges } = require('../server/services/rediscoveryLifecycle');

test('pending product may leave queue when later data becomes clean', () => {
  assert.deepEqual(rediscoveryLifecycleChanges({ status: 'PENDING_REVIEW' }, 'APPROVED'), { status: 'APPROVED' });
});
