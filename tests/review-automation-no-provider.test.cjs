const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('review quality policy does not make provider requests', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/dealQualityService.js'), 'utf8');
  assert.doesNotMatch(source, /axios|fetch\(|rainforestapi|providerRouter/);
});
