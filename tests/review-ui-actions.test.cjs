const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('pending review offers all practical decisions', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  for (const label of ['Publish Normally', 'Publish as Pick', 'Reject', 'Save for Later']) assert.match(source, new RegExp(label));
});
