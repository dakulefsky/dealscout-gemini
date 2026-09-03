const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repository = fs.readFileSync(path.join(__dirname, '..', 'server', 'repositories', 'sitemapRepository.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('sitemap repository selects only fresh public deal identity fields in PostgreSQL', () => {
  assert.match(repository, /SELECT id, asin, price_check_at/);
  assert.match(repository, /status = 'APPROVED'/);
  assert.match(repository, /source_verified = 1/);
  assert.match(repository, /is_expired <> 1/);
  assert.match(repository, /price_check_at >= \$1/);
  assert.doesNotMatch(repository, /SELECT \*/);
});

test('server sitemap uses the repository shared public-freshness default and never loads the full catalog', () => {
  assert.match(server, /sitemapRepository\.listFreshPublicDeals\(\)/);
  assert.doesNotMatch(server, /listFreshPublicDeals\(\{ maxAgeHours: 168 \}\)/);
  const sitemapBlock = server.match(/app\.get\('\/sitemap\.xml'[\s\S]*?\n  \}\);/i)?.[0] || '';
  assert.doesNotMatch(sitemapBlock, /dealRepository\.listAll\(\)/);
  assert.doesNotMatch(sitemapBlock, /allDeals\.filter/);
});
