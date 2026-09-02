const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('docs define automatic rejection standards', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/review-automation.md'), 'utf8');
  assert.ok(source.includes('Clearly invalid, unavailable, unverified, or sub-15% deals are rejected before entering the review queue.'));
});
