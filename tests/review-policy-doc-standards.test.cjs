const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('docs define automatic publication standards', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/review-automation.md'), 'utf8');
  assert.ok(source.includes('Verified, in-stock deals with a valid 15%+ price drop and product image publish automatically.'));
});
