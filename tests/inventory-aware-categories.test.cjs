const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('category API can return only categories backed by fresh public inventory', () => {
  const repository = read('server/repositories/categoryRepository.js');
  const route = read('server/routes/categories.js');

  assert.match(repository, /activeOnly = false/);
  assert.match(repository, /isPublicDeal\(deal\)/);
  assert.match(repository, /freshPriceThreshold\(nowSeconds\)/);
  assert.match(repository, /HAVING COUNT\(d\.id\) > 0/);
  assert.match(repository, /liveCount/);
  assert.match(route, /req\.query\.activeOnly === '1'/);
});

test('shopper navigation defaults to active categories while canonical category pages stay addressable', () => {
  const api = read('src/lib/apiCore.js');
  const categoryPage = read('src/pages/CategoryPage.jsx');

  assert.match(api, /categoryList\(\{ activeOnly: 1, \.\.\.params \}\)/);
  assert.match(categoryPage, /categoriesApi\.list\(\{ activeOnly: 0 \}\)/);
});
