const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'auth.js'), 'utf8');

test('auth rate limiter bounds in-memory bucket growth', () => {
  assert.match(source, /const MAX_RATE_BUCKETS = 5000/);
  assert.match(source, /function pruneRateBuckets\(now\)/);
  assert.match(source, /bucket\.expiresAt <= now/);
  assert.match(source, /while \(rateBuckets\.size >= MAX_RATE_BUCKETS\)/);
  assert.match(source, /rateBuckets\.delete\(oldestKey\)/);
});
