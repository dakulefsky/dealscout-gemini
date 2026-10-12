const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function load(file, overrides) {
  const filename = require.resolve(file);
  const realRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : realRequire(name),
    module, exports: module.exports, process, console, Date, URL,
  }, { filename });
  return module.exports;
}
const asin = 'B000000001';
const existing = { id: asin, asin, title: 'Old title', category: 'Electronics', status: 'EXPIRED', is_expired: 1, expired_at: 100, source_verified: 1, original_price: 100, sale_price: 70 };
const offer = { asin, title: 'Wireless headphones', category: 'Electronics', originalPrice: 100, salePrice: 70, imageUrl: 'https://example.com/image.jpg' };

function router(writes, result = {}) {
  return load('../server/services/providerRouter', {
    '../repositories/dealRepository': {
      update: async (id, changes, options) => { writes.push({ id, changes, options }); return result; },
      expire: async (id, reason, options) => { writes.push({ id, reason, options }); return result; },
    },
  });
}

test('paid bulk observations restore qualifying expired listings using fresh metadata and status guard', async () => {
  const writes = [];
  assert.equal(await router(writes).applyRainforestBulkRefreshes([existing], [offer], 200), 1);
  assert.equal(writes[0].changes.is_expired, 0);
  assert.equal(writes[0].changes.expired_at, null);
  assert.equal(writes[0].changes.status, 'APPROVED');
  assert.equal(writes[0].changes.title, offer.title);
  assert.equal(writes[0].changes.price_check_at, 200);
  assert.equal(writes[0].options.expectedStatus, 'EXPIRED');
});

test('restored extreme discounts and missing images still require review', async () => {
  for (const item of [{ ...offer, salePrice: 10 }, { ...offer, imageUrl: '' }]) {
    const writes = [];
    await router(writes).applyRainforestBulkRefreshes([existing], [item], 200);
    assert.equal(writes[0].changes.status, 'PENDING_REVIEW');
    assert.equal(writes[0].changes.is_expired, 0);
  }
});

test('unavailable offers and ended discounts are expired, while manual rejections stay untouched', async () => {
  for (const item of [{ ...offer, availability: 'Out of stock' }, { ...offer, salePrice: 99 }]) {
    const writes = [];
    await router(writes).applyRainforestBulkRefreshes([{ ...existing, status: 'APPROVED' }], [item]);
    assert.ok(writes[0].reason);
    assert.equal(writes[0].changes, undefined);
    assert.equal(writes[0].options.expectedStatus, 'APPROVED');
  }
  const writes = [];
  assert.equal(await router(writes).applyRainforestBulkRefreshes([{ ...existing, status: 'REJECTED' }], [offer]), 0);
  assert.equal(writes.length, 0);
});

test('a concurrent status change is not counted as a completed bulk refresh', async () => {
  assert.equal(await router([], null).applyRainforestBulkRefreshes([existing], [offer]), 0);
});

test('conditional PostgreSQL refresh is an atomic UPDATE that cannot recreate a deleted listing', async () => {
  let persisted = { ...existing };
  const statements = [];
  const repository = load('../server/repositories/dealRepository', {
    '../storage/postgres': {
      isConfigured: () => true,
      async query(sql, values) {
        if (sql.includes('CREATE TABLE') || sql.includes('ALTER TABLE') || sql.includes('CREATE INDEX')) return { rows: [] };
        if (sql.includes('COUNT(*)')) return { rows: [{ count: 1 }] };
        if (sql.startsWith('SELECT *')) return { rows: [persisted] };
        statements.push({ sql, values });
        persisted = { ...persisted, status: 'REJECTED' };
        return { rows: [] }; // status changed after SELECT and before UPDATE
      },
    },
  });
  assert.equal(await repository.update(asin, { status: 'APPROVED', is_expired: 0, price_check_at: 200 }, { expectedStatus: 'EXPIRED' }), null);
  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /UPDATE deals SET/);
  assert.match(statements[0].sql, /WHERE asin = \$4 AND status = \$5 RETURNING/);
  assert.doesNotMatch(statements[0].sql, /INSERT|ON CONFLICT/);
  assert.equal(statements[0].values.at(-1), 'EXPIRED');
  assert.equal(persisted.status, 'REJECTED');
});

test('conditional fallback refresh observes late manual status changes and rejects unsupported fields', async () => {
  const db = { tables: { deals: [{ ...existing }] }, saveDb() {} };
  const repository = load('../server/repositories/dealRepository', {
    '../db': db,
    '../storage/postgres': { isConfigured: () => false },
    './categoryRepository': { async ensureForDeal(category) { db.tables.deals[0].status = 'REJECTED'; return category; } },
  });
  assert.equal(await repository.update(asin, { status: 'APPROVED', category: 'Electronics' }, { expectedStatus: 'EXPIRED' }), null);
  assert.equal(db.tables.deals[0].status, 'REJECTED');
  db.tables.deals[0].status = 'EXPIRED';
  await assert.rejects(repository.update(asin, { asin: 'B000000002' }, { expectedStatus: 'EXPIRED' }), /Unsupported conditional/);
  const updated = await repository.update(asin, { status: 'APPROVED', is_expired: 0, expired_at: null }, { expectedStatus: 'EXPIRED' });
  assert.equal(updated.status, 'APPROVED');
  assert.equal(updated.is_expired, 0);
});
