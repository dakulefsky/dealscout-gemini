const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('all tests use the extension included by npm test', () => {
  const testsDir = __dirname;
  const skipped = fs.readdirSync(testsDir).filter((name) => name.endsWith('.test.js'));
  assert.deepEqual(skipped, [], `npm test only runs *.test.cjs; rename skipped tests: ${skipped.join(', ')}`);
});
