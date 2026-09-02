const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('operator policy includes all three lanes', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/review-automation.md'), 'utf8');
  assert.match(source, /publish automatically/);
  assert.match(source, /rejected before entering/);
  assert.match(source, /require human review/);
});
