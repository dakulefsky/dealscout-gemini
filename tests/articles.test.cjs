const test = require('node:test');
const assert = require('node:assert/strict');
const { page, catalog } = require('../server/services/articlesService');
const { buildSitemap } = require('../server/services/seoService');
const articles = require('../shared/articles.json');

test('article index and each article render crawlable text, links and their own canonical without catalog data', () => {
  const base = 'https://dealscouted.com';
  const index = page(base);
  assert.equal(index.status, 200);
  assert.equal(index.meta.canonical, `${base}/articles`);
  assert.equal(index.meta.jsonLd.mainEntity.itemListElement.length, 3);
  for (const item of catalog) assert.ok(index.html.includes(`href="${item.path}"`));
  for (const article of articles) {
    const result = page(base, article.slug);
    assert.equal(result.status, 200);
    assert.equal(result.meta.canonical, `${base}/articles/${article.slug}`);
    assert.equal(result.meta.jsonLd['@type'], 'Article');
    for (const section of article.sections) assert.ok(result.html.includes(section.title.replaceAll('&', '&amp;')));
    assert.match(result.html, /href="\/articles"/);
    assert.match(buildSitemap({ baseUrl: base }), new RegExp(`${base}/articles/${article.slug}`));
  }
});

test('unknown articles return noindex 404 rather than an indexable empty article', () => {
  const result = page('https://dealscouted.com', 'missing');
  assert.equal(result.status, 404);
  assert.equal(result.meta.robots, 'noindex,follow');
  assert.equal(result.meta.canonical, null);
});
