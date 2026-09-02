const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('random editorial sampling is documented as opt-in', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/review-automation.md'), 'utf8');
  assert.match(source, /Random editorial sampling is disabled by default/);
});
