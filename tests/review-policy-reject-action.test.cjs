const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('reject action writes REJECTED status', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.match(source, /dealsApi\.update\(deal\.id \|\| deal\.asin, \{ status: 'REJECTED' \}\)/);
});
