const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('current automatic review reasons are explicit exceptions', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/dealQualityService.js'), 'utf8');
  assert.match(source, /extreme discount requires review/);
  assert.match(source, /missing image requires review/);
});
