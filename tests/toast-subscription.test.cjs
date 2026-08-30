const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'hooks', 'use-toast.jsx'), 'utf8');

test('toast hook subscribes once per mount instead of on every toast state change', () => {
  assert.match(source, /useEffect\(\(\) => \{[\s\S]*listeners\.push\(setState\)[\s\S]*\}, \[\]\);/);
  assert.doesNotMatch(source, /\}, \[state\]\);/);
});

test('toast reducer preserves state for unknown actions', () => {
  assert.match(source, /default:\s*return state;/);
});

test('dead remove-queue helper stays removed', () => {
  assert.doesNotMatch(source, /_clearFromRemoveQueue/);
});
