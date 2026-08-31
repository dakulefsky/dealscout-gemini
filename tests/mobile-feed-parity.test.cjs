const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const mobileHome = fs.readFileSync(path.join(root, 'apps', 'mobile', 'app', 'index.jsx'), 'utf8');
const mobileDetail = fs.readFileSync(path.join(root, 'apps', 'mobile', 'app', 'deal', '[id].jsx'), 'utf8');
const mobilePersonalization = fs.readFileSync(path.join(root, 'apps', 'mobile', 'src', 'personalization.js'), 'utf8');
const webPersonalization = fs.readFileSync(path.join(root, 'src', 'lib', 'feedPersonalization.js'), 'utf8');

test('web and native use one platform-neutral personalization algorithm', () => {
  assert.match(webPersonalization, /from '\.\/personalizationCore\.js'/);
  assert.match(mobilePersonalization, /personalizationCore/);
  assert.match(mobileHome, /personalizedRank\(rankDeals\(items\), interests\)/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'src', 'lib', 'personalizationCore.js'), 'utf8'), /window|localStorage|SecureStore/);
});

test('native feed exposes the same server-backed shopper dimensions as web Home', () => {
  assert.match(mobileHome, /category: activeCategory === 'all' \? '' : activeCategory/);
  assert.match(mobileHome, /minDiscount: minDiscount \|\| ''/);
  assert.match(mobileHome, /minPrice: selectedPriceTier\.min \?\? ''/);
  assert.match(mobileHome, /maxPrice: selectedPriceTier\.max \?\? ''/);
  assert.match(mobileHome, /q: query\.trim\(\)/);
  assert.match(mobileHome, /discount_desc/);
  assert.match(mobileHome, /price_asc/);
  assert.match(mobileHome, /price_desc/);
  assert.match(mobileHome, /Best for you/);
  assert.match(mobileHome, /Biggest discount/);
});

test('native Deal Drop stays balanced and disappears while explicit filters are active', () => {
  assert.match(mobileHome, /balancedFeatured\(rankedItems, 4\)/);
  assert.match(mobileHome, /hasActiveFilters \? \[\] : balancedFeatured/);
  assert.match(mobileHome, /evenLength >= 2/);
});

test('native strong recommendation signals match website weights', () => {
  assert.match(mobileHome, /addCategoryInterest\(deal\.category, 4\)/);
  assert.match(mobileDetail, /addCategoryInterest\(deal\.category, 4\)/);
  assert.match(mobileDetail, /addCategoryInterest\(deal\.category, 3\)/);
  assert.match(mobileDetail, /Linking\.canOpenURL/);
});

test('shared personalization core preserves existing ranking and decay semantics', async () => {
  const moduleUrl = `${pathToFileURL(path.join(root, 'src', 'lib', 'personalizationCore.js')).href}?parity=${Date.now()}`;
  const core = await import(moduleUrl);
  const deals = [
    { id: 'a', category: 'Audio' },
    { id: 'b', category: 'Home' },
    { id: 'c', category: 'Audio' },
    { id: 'd', category: 'Toys' },
  ];
  const ranked = core.personalizedRank(deals, { audio: 10 });
  assert.equal(ranked[0].id, 'a');
  assert.equal(ranked[1].id, 'c');
  assert.equal(ranked[2].id, 'b');
  assert.equal(ranked[3].id, 'd');
  assert.equal(core.dwellWeight(4999), 0);
  assert.equal(core.dwellWeight(5000), 1);
  assert.equal(core.dwellWeight(12000), 2);
  assert.deepEqual(core.addInterest({}, 'Audio', 4), { audio: 4 });
});
