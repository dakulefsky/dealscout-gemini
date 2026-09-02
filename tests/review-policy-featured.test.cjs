const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('automatic publishing does not automatically make a DealScout Pick', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/services/dealQualityService.js'), 'utf8');
  assert.doesNotMatch(source, /isHumanPick|is_human_pick/);
});
