const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createServerBootstrapReader } = require('../src/lib/serverBootstrap.js');
const { freshScopedFeed, freshInitialFeed } = require('../shared/shoppingTools.mjs');

test('lazy pages retain captured feeds after React removes initial JSON nodes', () => {
  const now = Date.now();
  const deal = { id: 'one', sourceVerified: true, status: 'APPROVED', salePrice: 10, originalPrice: 20, priceCheckAt: now / 1000 };
  const nodes = new Map([
    ['initial-deals', { items: [deal], nextCursor: 'home-next' }],
    ['initial-scoped-deals', { scope: 'category/electronics', items: [deal], nextCursor: 'category-next' }],
    ['initial-guide-deals', { items: [deal] }],
  ]);
  const document = { getElementById: id => nodes.has(id) ? { textContent: JSON.stringify(nodes.get(id)) } : null };
  const reader = createServerBootstrapReader();
  reader.capture(document);
  nodes.clear();
  reader.capture(document); // Strict Mode or another mount must not overwrite the snapshot.
  assert.deepEqual(freshScopedFeed(reader.read('initial-scoped-deals'), 'category/electronics', 'best', now).items, [deal]);
  assert.equal(freshScopedFeed(reader.read('initial-scoped-deals'), 'category/baby', 'best', now).items.length, 0);
  assert.deepEqual(freshInitialFeed(reader.read('initial-guide-deals'), { sort: 'best' }, now).items, [deal]);
  assert.equal(freshInitialFeed(reader.read('initial-deals'), { sort: 'best' }, now).nextCursor, 'home-next');
  assert.deepEqual(freshInitialFeed(reader.read('initial-guide-deals'), { sort: 'best' }, now + 86400001).items, []);
});

test('capture ignores malformed and unrecognized bootstrap nodes', () => {
  const reader = createServerBootstrapReader();
  const bodies = { 'initial-deals': '[bad', 'initial-scoped-deals': '[]', 'initial-guide-deals': 'null', 'private-settings': '{"secret":"private"}' };
  reader.capture({ getElementById: id => ({ textContent: bodies[id] }) });
  for (const id of Object.keys(bodies)) assert.equal(reader.read(id), null);
  const entry = fs.readFileSync('src/main.jsx', 'utf8');
  assert.ok(entry.indexOf('captureServerBootstrap(document)') < entry.indexOf('ReactDOM.createRoot('));
});
