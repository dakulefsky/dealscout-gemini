const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review policy documents automatic publish, reject, and exception review lanes', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/review-automation.md'), 'utf8');
  assert.match(source, /publish automatically/i);
  assert.match(source, /rejected before entering the review queue/i);
  assert.match(source, /require human review/i);
});
