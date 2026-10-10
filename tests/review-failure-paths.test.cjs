const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function load(file, overrides, env) {
  const filename = require.resolve(file);
  const realRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: (name) => Object.hasOwn(overrides, name) ? overrides[name] : realRequire(name),
    module, exports: module.exports, process: env ? { env } : process, console, URL, Date, URIError,
  }, { filename });
  return module.exports;
}

test('runtime settings share schema initialization but still read current values', async () => {
  let creates = 0;
  let reads = 0;
  let value = 'jerusalem';
  const settings = load('../server/services/siteRuntimeSettingsService', {
    '../storage/postgres': {
      isConfigured: () => true,
      async query(sql) {
        if (sql.includes('CREATE TABLE')) { creates += 1; return { rows: [] }; }
        reads += 1;
        return { rows: [{ setting_key: 'closure_location', setting_value: value }] };
      },
    },
  });
  await Promise.all([settings.get('closure_location'), settings.get('closure_location')]);
  value = 'new_york';
  assert.equal((await settings.get('closure_location')).value, 'new_york');
  assert.equal(creates, 1);
  assert.equal(reads, 3);
});

test('a failed settings schema initialization can be retried', async () => {
  let creates = 0;
  const settings = load('../server/services/siteRuntimeSettingsService', {
    '../storage/postgres': {
      isConfigured: () => true,
      async query(sql) {
        if (sql.includes('CREATE TABLE') && ++creates === 1) throw new Error('connection lost');
        return { rows: [] };
      },
    },
  });
  await assert.rejects(settings.get('closure_location'), /connection lost/);
  assert.equal((await settings.get('closure_location')).value, 'jerusalem');
  assert.equal(creates, 2);
});

test('channel settings initialize the schema once and continue observing administrator pauses', async () => {
  let creates = 0;
  let enabled = true;
  const settings = load('../server/services/channelSettingsService', {
    '../storage/postgres': {
      isConfigured: () => true,
      async query(sql) {
        if (sql.includes('CREATE TABLE')) { creates += 1; return { rows: [] }; }
        return { rows: [{ channel: 'provider_api', enabled }] };
      },
    },
  });
  await Promise.all([settings.get('provider_api'), settings.ensureSchema()]);
  enabled = false;
  assert.equal((await settings.get('provider_api')).enabled, false);
  assert.equal(creates, 1);
});

for (const [label, file, invoke] of [
  ['provider budget', '../server/services/providerBudgetService', (service) => service.reserveRequest('rainforest')],
  ['publication queue', '../server/repositories/publicationQueueRepository', (service) => service.leaseNext('whatsapp_status')],
]) {
  for (const rollbackFails of [false, true]) {
    test(`${label} ${rollbackFails ? 'discards' : 'releases'} its connection after a failed transaction`, async () => {
      const operationError = new Error('connection interrupted');
      const rollbackError = new Error('rollback interrupted');
      let released = false;
      let releaseArgument;
      const client = {
        async query(sql) {
          if (sql === 'BEGIN') return { rows: [] };
          if (sql === 'ROLLBACK') {
            if (rollbackFails) throw rollbackError;
            return { rows: [] };
          }
          throw operationError;
        },
        release(error) { released = true; releaseArgument = error; },
      };
      const service = load(file, {
        '../storage/postgres': { isConfigured: () => true, query: async () => ({ rows: [] }), getPool: () => ({ connect: async () => client }) },
        './primeDayPolicy': { isPrimeDay: () => false, refresh: async () => {} },
      });
      await assert.rejects(invoke(service), (error) => error === operationError);
      assert.equal(released, true);
      assert.equal(releaseArgument, rollbackFails ? rollbackError : undefined);
    });
  }
}

test('bulk price refresh cannot turn a manually rejected product into an expired product', async () => {
  const writes = [];
  const provider = load('../server/services/providerRouter', {
    '../repositories/dealRepository': { expire: async (...args) => writes.push(args), update: async (...args) => writes.push(args) },
    './publicDealPolicy': { minimumDiscountPercent: () => 15 },
  });
  const count = await provider.applyRainforestBulkRefreshes(
    [{ id: 'rejected', asin: 'B000000001', status: 'REJECTED', is_expired: 1 }],
    [{ asin: 'B000000001', title: 'Product', salePrice: 99, originalPrice: 100 }],
  );
  assert.equal(count, 0);
  assert.equal(writes.length, 0);
});

test('failed page rendering returns readable, non-indexable HTML without exposing internals', () => {
  const seo = require('../server/services/seoService');
  const failure = seo.renderFailure(new Error('secret database connection details'));
  assert.equal(failure.status, 503);
  assert.equal(failure.retryAfter, '60');
  assert.match(failure.html, /<h1>DealScout is temporarily unavailable<\/h1>/);
  assert.match(failure.html, /noindex,follow/);
  assert.doesNotMatch(failure.html, /secret database|<script/);
  const invalidLink = seo.renderFailure(new URIError('URI malformed'));
  assert.equal(invalidLink.status, 400);
  assert.equal(invalidLink.retryAfter, null);
});

test('server-rendered Amazon buttons use the affiliate redirect even before JavaScript loads', () => {
  const source = fs.readFileSync(require.resolve('../server.js'), 'utf8');
  const helpers = source.slice(source.indexOf('function escapeHtml'), source.indexOf('const categoryContent'));
  const render = vm.runInNewContext(`${helpers}\ndealInitialContent`);
  const productUrl = 'https://www.amazon.com/dp/B000000001?tag=wrong-20&ref=test#details';
  const html = render({ title: 'A <product>', product_url: productUrl, sale_price: 10, original_price: 20 });
  const href = html.match(/href="([^"]+)" rel="nofollow sponsored"/)?.[1];
  const redirect = new URL(href, 'https://dealscouted.com');
  assert.equal(redirect.pathname, '/api/functions/amazon-redirect');
  assert.equal(redirect.searchParams.get('url'), productUrl);
  assert.match(html, /A &lt;product&gt;/);
});

test('price verification does not report success when the verified price could not be saved', async () => {
  let successes = 0;
  let failedItems = 0;
  let successfulJobs = 0;
  const deal = { id: 'deal', asin: 'B000000001', status: 'APPROVED', source_verified: 1 };
  const cron = load('../server/services/cronService', {
    '../storage/postgres': { withAdvisoryLock: async (_id, task) => ({ acquired: true, result: await task() }) },
    '../repositories/dealRepository': {
      listAll: async () => [deal],
      update: async (_id, changes) => { if (changes.price_check_at) throw new Error('database write failed'); },
    },
    '../repositories/refreshStateRepository': { get: async () => null, recordSuccess: async () => { successes += 1; }, recordFailure: async () => { failedItems += 1; } },
    '../repositories/maintenanceCadenceRepository': { markSucceeded: async () => { successfulJobs += 1; } },
    './providerRouter': { fetchProductByAsin: async () => ({ sourceVerified: true, originalPrice: 100, salePrice: 50, discountPercent: 50 }), getProviderStatus: async () => ({}) },
    './departmentSupplyService': { departmentVerificationQueue: (items) => items },
    './priceHistoryService': { recordObservation: async () => {} },
  });
  const result = await cron.checkDealPricesAndAvailability({ maxChecks: 1 });
  assert.equal(result.verifiedCount, 0);
  assert.equal(result.status, 'NOTICE');
  assert.equal(successes, 0);
  assert.equal(successfulJobs, 0);
  assert.equal(failedItems, 1);
});

test('database outages do not invalidate a valid admin session', async () => {
  const secret = 'test-only-auth-secret-longer-than-32-characters';
  const auth = load('../server/middleware/auth', {
    '../repositories/userRepository': { findById: async () => { throw new Error('connection timeout'); } },
  }, { JWT_SECRET: secret });
  const token = require('jsonwebtoken').sign({ id: 'test-admin', authVersion: 1 }, secret);
  let status;
  let nextCalled = false;
  const res = { status(code) { status = code; return this; }, json(body) { return body; } };
  await auth.requireAuth({ headers: { authorization: `Bearer ${token}` } }, res, () => { nextCalled = true; });
  assert.equal(status, 503);
  assert.equal(nextCalled, false);
  await auth.requireAuth({ headers: { authorization: 'Bearer invalid' } }, res, () => { nextCalled = true; });
  assert.equal(status, 401);
});

test('simultaneous password resets consume the link once and invalidate previous tokens once', async () => {
  const { hashSecret } = require('../server/services/authSecretService');
  const rawToken = 'test-only-reset-token';
  const stored = { id: 'test-user', reset_token: hashSecret(rawToken), reset_expires: Date.now() + 60000, token_version: 7, password: 'old-hash' };
  const users = load('../server/repositories/userRepository', {
    '../storage/postgres': { isConfigured: () => false },
    '../db': { tables: { users: [stored] }, saveDb() {} },
  });
  const pendingHashes = [];
  const router = load('../server/routes/auth', {
    '../repositories/userRepository': users,
    bcryptjs: { hash: (password) => new Promise((resolve) => {
      pendingHashes.push(() => resolve(`hash-${password}`));
      if (pendingHashes.length === 2) pendingHashes.forEach((finish) => finish());
    }) },
  });
  const handler = router.stack.find((layer) => layer.route?.path === '/reset-password').route.stack.at(-1).handle;
  const results = [];
  const response = () => ({
    code: 200,
    status(code) { this.code = code; return this; },
    json(body) { results.push({ code: this.code, body }); },
  });
  await Promise.all([
    handler({ body: { resetToken: rawToken, newPassword: 'first-password' } }, response()),
    handler({ body: { resetToken: rawToken, newPassword: 'second-password' } }, response()),
  ]);
  assert.deepEqual(results.map((result) => result.code).sort(), [200, 400]);
  assert.equal(stored.token_version, 8);
  assert.equal(stored.reset_token, null);
  assert.equal(stored.password, 'hash-first-password');
});

test('a reset token replaced or expired during password hashing cannot change the password', async () => {
  const stored = { id: 'user', reset_token: 'new-token', reset_expires: 100, token_version: 3, password: 'old-hash' };
  const users = load('../server/repositories/userRepository', {
    '../storage/postgres': { isConfigured: () => false },
    '../db': { tables: { users: [stored] }, saveDb() {} },
  });
  assert.equal(await users.consumePasswordReset('user', 'old-token', 'replacement-hash', 50), null);
  assert.equal(await users.consumePasswordReset('user', 'new-token', 'replacement-hash', 101), null);
  assert.equal(stored.password, 'old-hash');
  assert.equal(stored.token_version, 3);
});

test('expired cleanup retains manually rejected products so rediscovery cannot forget the rejection', async () => {
  const database = { tables: { deals: [
    { id: 'rejected', asin: 'B000000001', status: 'REJECTED', is_expired: 1, expired_at: 1 },
    { id: 'expired', asin: 'B000000002', status: 'EXPIRED', is_expired: 1, expired_at: 1 },
  ] }, saveDb() {} };
  const deals = load('../server/repositories/dealRepository', {
    '../storage/postgres': { isConfigured: () => false }, '../db': database,
  });
  const result = await deals.purgeExpired();
  assert.equal(result.purgedCount, 1);
  assert.equal(database.tables.deals.length, 1);
  assert.equal(database.tables.deals[0].status, 'REJECTED');
});
