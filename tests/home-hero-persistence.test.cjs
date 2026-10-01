const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const home = fs.readFileSync(path.join(__dirname, '..', 'src/pages/Home.jsx'), 'utf8');
async function select(items, show = true) {
  const { featuredDealCandidates } = await import('../src/lib/heroDealQuality.js');
  const balancedBody = home.slice(home.indexOf('function balancedFeatured'), home.indexOf('function mergeDeals'));
  const balance = new Function(balancedBody + '; return balancedFeatured;')();
  const body = home.match(/const spotlightDeals = useMemo\(\(\) => \{([\s\S]*?)\n  \}, \[visibleDeals/)[1];
  return new Function('visibleDeals', 'showCuratedHome', 'featuredDealCandidates', 'balancedFeatured', body)(items, show, featuredDealCandidates, balance);
}
function deal(id, category, discount, extra = {}) {
  return { id, category, title: id, originalPrice: 100, salePrice: 100 - discount,
    sourceVerified: true, priceCheckAt: Math.floor(Date.now() / 1000), ...extra };
}
test('Best deals favors strong verified savings while varying departments', async () => {
  const items = [deal('a', 'Electronics', 70), deal('b', 'Electronics', 60),
    deal('c', 'Home', 50), deal('d', 'Clothing', 40), deal('e', 'Beauty', 35),
    deal('f', 'Books', 95, { sourceVerified: false })];
  assert.deepEqual((await select(items)).map(d => d.id), ['a', 'c', 'd', 'e', 'b']);
});
test('a small catalog remains usable without 30-percent offers; filtered views omit the feature row', async () => {
  const items = [deal('a', 'Home', 20), deal('b', 'Beauty', 17)];
  assert.deepEqual((await select(items)).map(d => d.id), ['a', 'b']);
  assert.deepEqual(await select(items, false), []);
});
test('expired and unsupported offers stay out while old source-verified prices remain labeled', async () => {
  const items = [deal('expired', 'Home', 80, { isExpired: true }),
    deal('stale', 'Home', 80, { priceCheckAt: 1 }), deal('flat', 'Home', 0)];
  const featured = await select(items);
  assert.deepEqual(featured.map((item) => item.id), ['stale']);
  assert.equal(featured[0]._spotlightNeedsPriceCheck, true);
});
