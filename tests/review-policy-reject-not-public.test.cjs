const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('active editorial loader does not include REJECTED status', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.equal(source.includes("['APPROVED', 'PENDING_REVIEW', 'REJECTED']"), false);
});
