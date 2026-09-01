const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'ai.js'), 'utf8');

test('AI assistant limiter keeps its per-client bucket store bounded', () => {
  assert.match(source, /const MAX_ASSISTANT_BUCKETS = 5000/);
  assert.match(source, /assistantRateOps % 100 !== 0 && assistantRate\.size < MAX_ASSISTANT_BUCKETS/);
  assert.match(source, /while \(assistantRate\.size >= MAX_ASSISTANT_BUCKETS\)/);
  assert.match(source, /assistantRate\.delete\(oldestKey\)/);
});
