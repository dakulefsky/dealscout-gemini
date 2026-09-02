const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('reject clears featured intent', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/EditorialReview.jsx'), 'utf8');
  const rejectStart = source.indexOf('async function reject');
  const rejectEnd = source.indexOf('return (', rejectStart);
  assert.ok(source.slice(rejectStart, rejectEnd).includes('isHumanPick: false'));
});
