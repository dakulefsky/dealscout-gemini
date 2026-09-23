const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '..', 'apps', 'mobile', 'app', 'index.jsx'), 'utf8');

test('mobile featured section uses shared trustworthy discount logic', () => {
  assert.match(home, /trustworthyDiscountPercent/);
  assert.match(home, /discount >= 30/);
  assert.doesNotMatch(home, /Good deals\. No digging\./);
  assert.match(home, /DEPARTMENTS/);
  assert.doesNotMatch(home, /The deals worth seeing\./);
});
