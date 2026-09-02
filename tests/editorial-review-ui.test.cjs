const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review page is exception-driven and exposes reject', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  assert.match(source, /Review Exceptions/);
  assert.match(source, /Normal verified deals publish automatically/);
  assert.match(source, /Publish Normally/);
  assert.match(source, /Publish as Pick/);
  assert.match(source, /> Reject/);
  assert.match(source, /status: 'REJECTED'/);
  assert.match(source, /filter === 'needs-review'\) return deal\.status === 'PENDING_REVIEW'/);
});
