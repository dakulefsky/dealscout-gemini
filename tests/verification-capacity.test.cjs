const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { verificationBatchSize, freshnessCapacity } = require('../server/services/verificationCapacity');

test('verification capacity targets the same 24-hour window used by public prices', () => {
  assert.equal(verificationBatchSize(0), 0);
  assert.equal(verificationBatchSize(1), 2);
  assert.equal(verificationBatchSize(4), 2);
  assert.equal(verificationBatchSize(8), 4);
  assert.equal(verificationBatchSize(12), 6);
});

test('verification capacity stays tightly bounded for provider cost safety', () => {
  assert.equal(verificationBatchSize(500), 6);
  assert.equal(verificationBatchSize(500, { maxBatch: 10 }), 10);
  assert.equal(verificationBatchSize(20, { intervalHours: 12, targetHours: 24, minBatch: 2, maxBatch: 20 }), 10);
  assert.equal(freshnessCapacity(), 12);
  assert.equal(freshnessCapacity({ maxBatch: 10 }), 20);
});

test('cron uses dynamic verification capacity instead of a fixed batch of 10', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'cronService.js'), 'utf8');
  assert.equal(source.includes('verificationBatchSize(activeDeals.length)'), true);
  assert.equal(source.includes('oldestCheckedFirst(activeDeals, 10)'), false);
});
