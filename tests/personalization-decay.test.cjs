const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'feedPersonalization.js'), 'utf8');

test('shopper interests decay gradually instead of remaining permanent', () => {
  assert.match(source, /DAILY_DECAY = 0\.97/);
  assert.match(source, /DECAY_INTERVAL_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(source, /DAILY_DECAY \*\* days/);
});

test('tiny stale interests are removed from the local profile', () => {
  assert.match(source, /MIN_RETAINED_SCORE = 0\.25/);
  assert.match(source, /score >= MIN_RETAINED_SCORE/);
});

test('decay remains local browser state', () => {
  assert.match(source, /dealscout-feed-interests-decay-v1/);
  assert.match(source, /window\.localStorage\.setItem\(DECAY_KEY/);
  assert.doesNotMatch(source, /fetch\(/);
});
