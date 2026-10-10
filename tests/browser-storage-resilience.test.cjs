const test = require('node:test');
const assert = require('node:assert/strict');

test('blocked storage does not prevent browsing and keeps a stable guest identity', async () => {
  const { createBrowserIdentity } = await import('../src/lib/browserIdentity.js');
  const { createDealScoutClient } = await import('../src/lib/apiCore.js');
  const identity = createBrowserIdentity({ storage: () => { throw new Error('SecurityError'); } });
  const identities = [];
  const client = createDealScoutClient({ ...identity, fetchImpl: async (_url, options) => {
    identities.push(options.headers['x-guest-id']);
    return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ items: [] }) };
  } });
  await client.deals.page();
  await client.bookmarks.list();
  assert.equal(identities.length, 2);
  assert.equal(identities[0], identities[1]);
  assert.match(identities[0], /^guest_[a-z0-9_-]{9,80}$/i);
  assert.equal(identity.getToken(), null);
  assert.doesNotThrow(() => identity.setToken(null));
  assert.throws(() => identity.setToken('test-token'), /Allow site storage to sign in/);
});

test('quota-exhausted storage does not generate a new identity on every request', async () => {
  const { createBrowserIdentity } = await import('../src/lib/browserIdentity.js');
  const identity = createBrowserIdentity({ storage: () => ({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } }) });
  assert.equal(identity.getGuestId(), identity.getGuestId());
});

test('normal storage persists guest identity and continues to observe token changes', async () => {
  const { createBrowserIdentity } = await import('../src/lib/browserIdentity.js');
  const values = new Map();
  const storage = () => ({ getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) });
  const first = createBrowserIdentity({ storage });
  const second = createBrowserIdentity({ storage });
  assert.equal(first.getGuestId(), second.getGuestId());
  first.setToken('test-token');
  assert.equal(second.getToken(), 'test-token');
  second.setToken(null);
  assert.equal(first.getToken(), undefined);
});
