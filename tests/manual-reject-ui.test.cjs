const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review exceptions provide a direct reject action', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.match(source, /async function reject\(deal\)/);
  assert.match(source, /status: 'REJECTED'/);
  assert.match(source, /Deal rejected/);
});
