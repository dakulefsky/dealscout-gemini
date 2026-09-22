const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobile = fs.readFileSync(path.join(__dirname, '..', 'apps', 'mobile', 'app', 'deal', '[id].jsx'), 'utf8');

test('mobile product page does not label every deal as a DealScout Pick', () => {
  assert.doesNotMatch(mobile, />DEALSCOUT PICK</);
  assert.match(mobile, /deal\.category \|\| 'DEAL'/);
});

test('mobile product recommendations use the shared quality ranking', () => {
  assert.match(mobile, /dealRankScore\(candidate\)/);
  assert.doesNotMatch(mobile, /const discount = Number\(field\(candidate/);
});
