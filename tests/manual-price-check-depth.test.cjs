const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server/routes/functions.js'), 'utf8');

test('manual price verification requests one bounded batch per HTTP call', () => {
  assert.match(source, /requestedLimit = Math\.min\(2, Math\.max\(1, Number\(req\.body\?\.limit\) \|\| 2\)\)/);
  assert.match(source, /await dealCron\.checkDealPricesAndAvailability\(\{ maxChecks: requestedLimit \}\)/);
  assert.doesNotMatch(source, /while \(totals\.checkedCount < requestedLimit\)/);
});

test('manual verification reports the batch result to the admin client', () => {
  assert.match(source, /\.\.\.result,/);
  assert.match(source, /passes: 1,/);
});
