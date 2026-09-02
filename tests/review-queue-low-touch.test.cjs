const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review queue exposes reject and is exception-driven', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.match(source, /Review Exceptions/);
  assert.match(source, /Normal verified deals publish automatically/);
  assert.match(source, /> Reject</);
  assert.match(source, /status: 'REJECTED'/);
  assert.doesNotMatch(source, /Held for review/);
});
