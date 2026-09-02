const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('owner has complete decision set for exceptions', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  for (const text of ['Publish Normally', 'Publish as Pick', 'Reject', 'Save for Later']) assert.ok(source.includes(text));
});
