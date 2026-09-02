const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
