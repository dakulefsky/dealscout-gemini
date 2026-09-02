const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('operator docs call human review an exception path', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/review-automation.md'), 'utf8');
  assert.ok(source.includes('human review as an exception path'));
});
