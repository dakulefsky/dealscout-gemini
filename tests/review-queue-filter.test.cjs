const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('needs-review filter only includes pending review deals', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.match(source, /filter === 'needs-review'\) return deal\.status === 'PENDING_REVIEW'/);
  assert.doesNotMatch(source, /\|\| !e\.reviewedAt/);
});
