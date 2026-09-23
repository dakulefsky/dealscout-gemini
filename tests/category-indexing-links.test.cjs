const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seo = require('../server/services/seoService');

test('category metadata exposes current deal links as an ItemList', () => {
  const meta = seo.categoryMeta('https://dealscouted.com', { name: 'Baby', slug: 'baby', description: 'Baby essentials.' }, [
    { id: 'B000000001', asin: 'B000000001', title: 'Baby item one' },
    { id: 'B000000002', asin: 'B000000002', title: 'Baby item two' },
  ]);
  const page = meta.jsonLd['@graph'].find((node) => node['@type'] === 'CollectionPage');
  assert.equal(page.mainEntity.itemListElement.length, 2);
  assert.equal(page.mainEntity.itemListElement[0].url, 'https://dealscouted.com/deal/B000000001');
});

test('server-rendered category content includes live deal links for crawlers', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /dealFeedRepository\.page\(\{ category: rows\[0\]\.name, limit: 12, sort: 'discount_desc' \}\)/);
  assert.match(server, /categoryInitialContent\(rows\[0\], categoryDeals\)/);
  assert.match(server, /Category crawl links unavailable/);
  assert.match(server, /data-server-crawl-content="category"/);
});

test('homepage crawler metadata includes the full active category list', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'services', 'seoService.js'), 'utf8');
  assert.match(source, /const itemListElement = categories\.map/);
  assert.doesNotMatch(source, /categories\.slice\(0, 12\)\.map/);
});
