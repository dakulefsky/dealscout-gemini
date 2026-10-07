const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { apiIndexing } = require('../server/middleware/apiIndexing');
const { buildRobots } = require('../server/services/seoService');

test('robots permits rendering data but excludes private API and admin paths', () => {
  const rules = buildRobots('https://dealscouted.com').split('\n')
    .map((line) => line.match(/^(Allow|Disallow): (.+)$/)).filter(Boolean);
  function allowed(path) {
    const matches = rules.filter((r) => path.startsWith(r[2])).sort((a, b) => b[2].length - a[2].length);
    return !matches.length || matches[0][1] === 'Allow';
  }
  for (const path of ['/api/v1/deals/feed?limit=24', '/api/v1/deals/B123', '/api/v1/categories', '/api/editorial/picks']) assert.equal(allowed(path), true);
  for (const path of ['/api/v1/auth/me', '/api/v1/bookmarks', '/api/functions/deal-refresh', '/admin']) assert.equal(allowed(path), false);
});

test('API noindex does not affect page indexing or remove route authorization', async () => {
  const app = express();
  app.use('/api', apiIndexing);
  app.get('/', (_req, res) => res.send('Home'));
  app.get('/api/v1/deals/feed', (_req, res) => res.json({ items: [] }));
  app.get('/api/private', (_req, res) => res.sendStatus(401));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const home = await fetch(base);
    assert.equal(home.headers.get('x-robots-tag'), null);
    const feed = await fetch(base + '/api/v1/deals/feed');
    assert.equal(feed.status, 200);
    assert.equal(feed.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.deepEqual(await feed.json(), { items: [] });
    const privatePage = await fetch(base + '/api/private');
    assert.equal(privatePage.status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
