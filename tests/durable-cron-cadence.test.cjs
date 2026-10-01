const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cronService = require('../server/services/cronService');

test('price-only verification runs once per day in a bounded rotating batch', () => {
  assert.equal(cronService.JOB_INTERVALS.verifyPrices, 24 * 60 * 60);
  assert.equal(cronService.dailyPriceVerificationBatchSize(171), 12);
  assert.equal(cronService.dailyPriceVerificationBatchSize(8), 8);
  assert.equal(cronService.dailyPriceVerificationBatchSize(0), 0);
});

test('scheduled provider jobs claim PostgreSQL-backed cadence before work', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/cronService.js'), 'utf8');
  assert.match(source, /maintenanceCadence\.claim/);
  assert.match(source, /claimCadence\('discover-deals'/);
  assert.match(source, /claimCadence\('verify-prices'/);
  assert.match(source, /runFullCycle\(\{ scheduled: true \}\)/);
});

test('admin countdown reads durable discovery due time', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/cronService.js'), 'utf8');
  assert.match(source, /maintenanceCadence\.get\('discover-deals'\)/);
  assert.match(source, /scheduleSource: durableNextDue > 0 \? 'postgres'/);
});
