const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { verificationBatchSize } = require('../server/services/verificationCapacity');

test('verification capacity scales to cover the active catalog within 24 hours', () => {
  assert.equal(verificationBatchSize(0), 0);
  assert.equal(verificationBatchSize(20), 10);
  assert.equal(verificationBatchSize(40), 10);
  assert.equal(verificationBatchSize(41), 11);
  assert.equal(verificationBatchSize(100), 25);
  assert.equal(verificationBatchSize(200), 50);
});

test('verification capacity remains bounded for provider safety', () => {
  assert.equal(verificationBatchSize(500), 50);
  assert.equal(verificationBatchSize(500, { maxBatch: 100 }), 100);
});

test('cron uses dynamic verification capacity instead of a fixed batch of 10', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'cronService.js'), 'utf8');
  assert.equal(source.includes('verificationBatchSize(activeDeals.length)'), true);
  assert.equal(source.includes('oldestCheckedFirst(activeDeals, 10)'), false);
});
