const test = require('node:test');
const assert = require('node:assert/strict');

const NOW = Date.UTC(2026, 7, 27, 20, 0, 0);
const unix = (ms) => Math.floor(ms / 1000);

test('verification freshness formats recent checks', async () => {
  const { verificationFreshness } = await import('../src/lib/verificationFreshness.js');
  assert.equal(verificationFreshness(unix(NOW - 20_000), NOW).label, 'Price checked just now');
  assert.equal(verificationFreshness(unix(NOW - 12 * 60_000), NOW).label, 'Price checked 12 min ago');
  assert.equal(verificationFreshness(unix(NOW - 3 * 60 * 60_000), NOW).label, 'Price checked 3 hrs ago');
});

test('verification freshness flags old checks as stale', async () => {
  const { verificationFreshness } = await import('../src/lib/verificationFreshness.js');
  assert.equal(verificationFreshness(unix(NOW - 11 * 60 * 60_000), NOW).stale, false);
  assert.equal(verificationFreshness(unix(NOW - 12 * 60 * 60_000), NOW).stale, true);
  assert.equal(verificationFreshness(unix(NOW - 2 * 24 * 60 * 60_000), NOW).label, 'Price checked 2 days ago');
});

test('missing verification time is explicit and stale', async () => {
  const { verificationFreshness } = await import('../src/lib/verificationFreshness.js');
  const result = verificationFreshness(null, NOW);
  assert.equal(result.label, 'Verification time unavailable');
  assert.equal(result.stale, true);
});
