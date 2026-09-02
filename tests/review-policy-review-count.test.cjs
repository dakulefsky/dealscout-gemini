const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('quality service names explicit review exceptions', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/dealQualityService.js'), 'utf8');
  assert.ok(source.includes('extreme discount requires review'));
  assert.ok(source.includes('missing image requires review'));
});
