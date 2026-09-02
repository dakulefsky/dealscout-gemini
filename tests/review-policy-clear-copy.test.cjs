const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('clear queue is a positive automation state', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.ok(source.includes('Automation is handling the ordinary deals.'));
});
