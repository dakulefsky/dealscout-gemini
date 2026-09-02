const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('human retains publish, feature, reject, and defer controls', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  ['Publish Normally', 'Publish as Pick', 'Reject', 'Save for Later'].forEach((label) => assert.ok(source.includes(label)));
});
