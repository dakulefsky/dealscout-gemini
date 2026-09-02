const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('queue purpose is specific human decisions', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.ok(source.includes('specific reason to need a human decision'));
});
