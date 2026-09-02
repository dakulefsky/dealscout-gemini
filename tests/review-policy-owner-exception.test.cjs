const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('owner-facing queue is explicitly an exception queue', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.ok(source.includes('Review Exceptions'));
  assert.ok(source.includes('Needs a decision'));
});
