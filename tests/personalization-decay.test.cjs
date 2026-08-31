const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const adapter = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'feedPersonalization.js'), 'utf8');
const core = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'personalizationCore.js'), 'utf8');

test('shopper interests decay gradually instead of remaining permanent', () => {
  assert.match(core, /DAILY_DECAY = 0\.97/);
  assert.match(core, /DECAY_INTERVAL_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(core, /DAILY_DECAY \*\* days/);
});

test('tiny stale interests are removed from the local profile', () => {
  assert.match(core, /MIN_RETAINED_SCORE = 0\.25/);
  assert.match(core, /score >= MIN_RETAINED_SCORE/);
});

test('decay remains local browser state', () => {
  assert.match(adapter, /dealscout-feed-interests-decay-v1/);
  assert.match(adapter, /window\.localStorage\.setItem\(DECAY_KEY/);
  assert.doesNotMatch(adapter, /fetch\(/);
});
