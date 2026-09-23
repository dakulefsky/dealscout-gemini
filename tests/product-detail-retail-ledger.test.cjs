const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'DealDetail.jsx'), 'utf8');

test('product facts render as one ledger strip rather than equal feature cards', () => {
  assert.match(source, /flex flex-wrap items-center gap-x-6/);
  assert.doesNotMatch(source, /grid grid-cols-1 sm:grid-cols-3 border-x/);
});

test('recommendation language stays terse and retail-like', () => {
  assert.match(source, /Same aisle/);
  assert.match(source, /Other live deals/);
  assert.doesNotMatch(source, /More deals you might like|weighted toward this category/);
});
