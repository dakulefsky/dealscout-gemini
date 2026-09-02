const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review UI no longer foregrounds random holdback bucket', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.doesNotMatch(source, /Held for review/);
  assert.doesNotMatch(source, /\['holdback'/);
});
