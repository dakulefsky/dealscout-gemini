const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const seo = require('../server/services/seoService');

const root = path.join(__dirname, '..');

test('category metadata uses a durable collection page and breadcrumb schema', () => {
  const meta = seo.categoryMeta('https://dealscout.example', {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Tech, audio, computers, TVs, gaming, and smart devices.',
  });

  assert.equal(meta.canonical, 'https://dealscout.example/category/electronics');
  assert.match(meta.title, /Electronics Deals & Price Drops/);
  assert.equal(meta.jsonLd['@context'], 'https://schema.org');
  assert.equal(meta.jsonLd['@graph'][0]['@type'], 'CollectionPage');
  assert.equal(meta.jsonLd['@graph'][1]['@type'], 'BreadcrumbList');
});

test('sitemap focuses on canonical URLs and fresh deal lastmod values', () => {
  const nowMs = 2_000_000_000_000;
  const xml = seo.buildSitemap({
    baseUrl: 'https://dealscout.example',
    categories: [{ slug: 'electronics' }],
    deals: [{ id: 'B0001', price_check_at: Math.floor(nowMs / 1000) }],
    nowMs,
  });

  assert.match(xml, /\/category\/electronics/);
  assert.match(xml, /\/deal\/B0001/);
  assert.match(xml, /<lastmod>/);
  assert.doesNotMatch(xml, /<priority>/);
  assert.doesNotMatch(xml, /<changefreq>/);
});

test('category shopper page contains evergreen guidance and internal category links', () => {
  const page = fs.readFileSync(path.join(root, 'src', 'pages', 'CategoryPage.jsx'), 'utf8');
  const content = fs.readFileSync(path.join(root, 'src', 'lib', 'categorySeoContent.js'), 'utf8');

  assert.match(page, /categorySeoContent/);
  assert.match(page, /Deal guide/);
  assert.match(page, /Related deal categories/);
  assert.match(page, /to=\{`\/category\/\$\{item\.slug\}`\}/);
  assert.match(content, /electronics:/);
  assert.match(content, /home-kitchen/);
  assert.match(content, /grocery:/);
});
