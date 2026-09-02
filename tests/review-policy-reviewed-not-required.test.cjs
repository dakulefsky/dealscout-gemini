const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('queue membership is not based on missing editorial review timestamp', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.equal(source.includes("deal.status === 'PENDING_REVIEW' || !e.reviewedAt"), false);
});
