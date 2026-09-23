const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seo = require('../server/services/seoService');

test('sitemap gives home and category pages meaningful inventory lastmod values', () => {
  const newest = 2_000_000_000;
  const older = newest - 300;
  const xml = seo.buildSitemap({
    baseUrl: 'https://dealscouted.com',
    nowMs: newest * 1000,
    categories: [
      { name: 'Baby', slug: 'baby' },
      { name: 'Electronics', slug: 'electronics' },
    ],
    deals: [
      { id: 'BABY1', category: 'Baby', price_check_at: older },
      { id: 'BABY2', category: 'Baby', price_check_at: newest },
      { id: 'ELEC1', category: 'Electronics', price_check_at: older },
    ],
  });
  const newestIso = new Date(newest * 1000).toISOString();
  assert.match(xml, new RegExp(`<loc>https://dealscouted\\.com/</loc><lastmod>${newestIso.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&')}</lastmod>`));
  assert.match(xml, new RegExp(`<loc>https://dealscouted\\.com/category/baby</loc><lastmod>${newestIso.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&')}</lastmod>`));
});

test('sitemap repository selects category for category freshness aggregation', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'repositories', 'sitemapRepository.js'), 'utf8');
  assert.match(source, /SELECT id, asin, category, price_check_at/);
});

test('robots and sitemap responses are briefly cacheable', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(source, /public, max-age=900, stale-while-revalidate=3600/);
});
