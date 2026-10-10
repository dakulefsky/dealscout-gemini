const test = require('node:test');
const assert = require('node:assert/strict');
const supply = require('../server/services/departmentSupplyService');
const settings = require('../server/services/siteRuntimeSettingsService');
const { selectBalancedDeals } = require('../server/services/rainforestStrictDiscovery');
const now = Math.floor(Date.now() / 1000);
const deal = (id, category, checked = now, changes = {}) => ({ id, asin: id, category, title: id,
  source_verified: 1, status: 'APPROVED', is_expired: 0, original_price: 100, sale_price: 60, price_check_at: checked, ...changes });
const metadata = [{ category_id: '123', name: 'Baby' }, { category_id: '456', name: 'Pet Supplies' }, { category_id: '789', name: 'Electronics' }, { category_id: '987', name: 'Grocery' }];
const state = (changes = {}) => ({ domain: 'amazon.com', observedAt: now * 1000, pulls: 1, categories: supply.categoriesFromResponse(metadata), lastTargetAt: {}, ...changes });

test('stock counts fresh public products and unique quantity families, including empty departments', () => {
  const stock = supply.departmentStock([
    deal('a', 'Baby'), deal('b', 'Baby', now - 86401), deal('c', 'Baby', now, { status: 'PENDING_REVIEW' }),
    deal('d', 'Baby', now, { sale_price: 95 }), deal('e', 'Baby', now, { source_verified: 0 }),
    deal('f', 'Baby', now, { is_expired: 1 }), deal('g', 'Baby', now, { title: 'Acme wipes pack of 2' }),
    deal('h', 'Baby', now, { title: 'Acme wipes pack of 3' }),
  ], now);
  assert.equal(stock.Baby, 2);
  assert.equal(stock.Grocery, 0);
});

test('thin departments are targeted using observed IDs, rotate even if no deals were found, and get regular broad pulls', () => {
  const full = Array.from({ length: 8 }, (_, i) => deal(String(i), 'Electronics'));
  const plan = supply.planDiscovery(full, state(), now * 1000);
  assert.deepEqual(new Set(plan.targets), new Set(['Baby', 'Pet Supplies', 'Grocery']));
  assert.equal(plan.categoryId.split(',').includes('789'), false);
  const rotated = supply.planDiscovery([], state({ lastTargetAt: { Baby: now * 1000 } }), now * 1000);
  assert.equal(rotated.targets.includes('Baby'), false, 'an unsuccessful empty department cannot monopolize all targeted pulls');
  assert.equal(supply.planDiscovery(full, state({ pulls: 3 }), now * 1000).categoryId, '');
  assert.equal(supply.planDiscovery(full, state({ observedAt: (now - 8 * 86400) * 1000 }), now * 1000).categoryId, '');
  assert.equal(supply.planDiscovery(full, state({ domain: 'amazon.co.uk' }), now * 1000).categoryId, '');
});

test('malformed provider IDs and cached taxonomy safely fall back without inventing categories', () => {
  assert.deepEqual(supply.categoriesFromResponse([{ category_id: '1&max_page=99', name: 'Baby' }, null, { category_id: '123' }]), []);
  for (const categories of [null, {}, ['bad', null]]) {
    assert.equal(supply.planDiscovery([], state({ categories }), now * 1000).categoryId, '');
  }
});

test('candidate capacity first fills thin departments with good deals, then uses remaining slots', () => {
  const rows = [...Array.from({ length: 30 }, (_, i) => ({ asin: `e${i}`, category: 'Electronics', discountPercent: 50 })),
    ...Array.from({ length: 8 }, (_, i) => ({ asin: `b${i}`, category: 'Baby', discountPercent: 25 }))];
  const selected = selectBalancedDeals(rows, 10, { Electronics: 20, Baby: 0 });
  assert.equal(selected.filter(row => row.category === 'Baby').length, 6);
  assert.equal(selected.length, 10);
  assert.equal(selectBalancedDeals(rows.slice(0, 30), 10, { Electronics: 20 }).length, 10, 'soft balancing never wastes otherwise good inventory');
});

test('refresh queue protects empty departments and keeps oldest-first order inside each department', () => {
  const rows = [deal('e1', 'Electronics', now - 200000), deal('e2', 'Electronics', now - 190000),
    deal('baby1', 'Baby', now - 90000), deal('baby2', 'Baby', now - 88000),
    ...Array.from({ length: 8 }, (_, i) => deal(`fresh${i}`, 'Electronics'))];
  const queue = supply.departmentVerificationQueue(rows, now);
  assert.deepEqual(queue.slice(0, 4).map(row => row.id), ['baby1', 'e1', 'baby2', 'e2']);
  assert.equal(new Set(queue.map(row => row.id)).size, rows.length);
});

test('learned taxonomy and targeting survive a process restart through shared settings', async () => {
  settings.resetLocalSettings();
  try {
    const initial = await supply.prepareDiscovery([]);
    assert.equal(initial.categoryId, '');
    await supply.recordDiscovery(initial, metadata);
    const next = await supply.prepareDiscovery([]);
    assert.ok(next.categoryId);
    await supply.recordDiscovery(next, []);
    const restored = await supply.prepareDiscovery([]);
    assert.equal(restored.pulls, 2);
    assert.equal(restored.categories.length, 4);
    assert.ok(restored.targets.some(name => !next.targets.includes(name)));
    await settings.set('rainforest_department_discovery', '{corrupt');
    assert.equal((await supply.prepareDiscovery([])).categoryId, '');
  } finally { settings.resetLocalSettings(); }
});

test('scheduled upkeep avoids rechecking newly discovered prices while manual checks remain available', () => {
  const rows = [deal('newBaby', 'Baby', now), deal('dueBaby', 'Baby', now - 19 * 3600), deal('staleTech', 'Electronics', now - 90000)];
  const scheduled = supply.departmentVerificationQueue(rows, now, { includeFresh: false });
  assert.deepEqual(new Set(scheduled.map(row => row.id)), new Set(['dueBaby', 'staleTech']));
  assert.equal(supply.departmentVerificationQueue(rows, now, { includeFresh: true }).length, 3);
});
