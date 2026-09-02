const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review queue tells admin why a deal needs attention', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.match(source, /Why review:/);
  assert.match(source, /Extreme discount/);
  assert.match(source, /Missing product image/);
});
