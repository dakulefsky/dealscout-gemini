const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'middleware', 'securityBaseline.js'), 'utf8');

test('global API rate limiter bounds and amortizes its in-memory bucket store', () => {
  assert.match(source, /const MAX_RATE_BUCKETS = 5000/);
  assert.match(source, /limiterOps % 100 !== 0 && buckets\.size < MAX_RATE_BUCKETS/);
  assert.match(source, /while \(buckets\.size >= MAX_RATE_BUCKETS\)/);
  assert.match(source, /buckets\.delete\(oldestKey\)/);
});
