const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { verificationBatchSize } = require('../server/services/verificationCapacity');

test('verification capacity refreshes the catalog on a low-cost 72-hour target', () => {
  assert.equal(verificationBatchSize(0), 0);
  assert.equal(verificationBatchSize(1), 2);
  assert.equal(verificationBatchSize(12), 2);
  assert.equal(verificationBatchSize(20), 4);
  assert.equal(verificationBatchSize(30), 5);
  assert.equal(verificationBatchSize(36), 6);
});

test('verification capacity stays tightly bounded for provider cost safety', () => {
  assert.equal(verificationBatchSize(500), 6);
  assert.equal(verificationBatchSize(500, { maxBatch: 10 }), 10);
  assert.equal(verificationBatchSize(20, { intervalHours: 12, targetHours: 24, minBatch: 2, maxBatch: 20 }), 10);
});

test('cron uses dynamic verification capacity instead of a fixed batch of 10', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'cronService.js'), 'utf8');
  assert.equal(source.includes('verificationBatchSize(activeDeals.length)'), true);
  assert.equal(source.includes('oldestCheckedFirst(activeDeals, 10)'), false);
});
