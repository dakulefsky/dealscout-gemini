const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seo = require('../server/services/seoService');

test('homepage leads with departments and keeps standout deals secondary', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Home.jsx'), 'utf8');
  assert.match(source, /Departments/);
  assert.match(source, />Departments<\/h1>/);
  assert.match(source, />Standouts<\/h2>/);
  assert.match(source, /trustworthyDiscountPercent\(deal\)/);
  assert.doesNotMatch(source, /What are you here for\?/);
});

test('homepage SEO exposes crawlable category hub structured data', () => {
  const meta = seo.homeMeta('https://dealscouted.com', [
    { name: 'Home & Kitchen', slug: 'home-kitchen' },
    { name: 'Baby', slug: 'baby' },
  ]);
  assert.equal(meta.canonical, 'https://dealscouted.com/');
  assert.match(meta.title, /by Category/);
  const graph = meta.jsonLd['@graph'];
  const itemList = graph.find((node) => node['@type'] === 'CollectionPage').mainEntity.itemListElement;
  assert.equal(itemList.length, 2);
  assert.equal(itemList[0].url, 'https://dealscouted.com/category/home-kitchen');
  assert.equal(itemList[1].url, 'https://dealscouted.com/category/baby');
});

test('server passes active categories into homepage SEO rendering', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /meta = seo\.homeMeta\(baseUrl, categories\)/);
  assert.match(server, /initialContent = homeInitialContent\(categories\)/);
});


test('release smoke protects Google-facing crawl signals', () => {
  const smoke = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'release-smoke.mjs'), 'utf8');
  assert.match(smoke, /public-home-indexable/);
  assert.match(smoke, /robots-indexable/);
  assert.match(smoke, /sitemap-indexable/);
  assert.match(smoke, /data-server-crawl-content="home"/);
});
