const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server/routes/functions.js'), 'utf8');

test('manual price verification honors a bounded requested depth', () => {
  assert.match(source, /requestedLimit = Math\.min\(50, Math\.max\(1, Number\(req\.body\?\.limit\) \|\| 15\)\)/);
  assert.match(source, /while \(totals\.checkedCount < requestedLimit\)/);
  assert.match(source, /await dealCron\.checkDealPricesAndAvailability\(\)/);
  assert.match(source, /totals\.passes >= 10/);
});

test('manual verification stops when provider capacity is deferred or no progress is possible', () => {
  assert.match(source, /if \(result\?\.providerDeferred\)/);
  assert.match(source, /providerDeferredReason/);
  assert.match(source, /providerRetryAt/);
  assert.match(source, /result\?\.skipped \|\| Number\(result\?\.checkedCount \|\| 0\) === 0/);
});
