const test = require('node:test');
const assert = require('node:assert/strict');
const seo = require('../server/services/seoService');

test('route metadata replaces generic shell tags instead of duplicating them', () => {
  const html = `<html><head>
    <title>Generic</title>
    <meta name="description" content="generic" />
    <meta name="robots" content="index,follow" />
    <meta property="og:title" content="Generic" />
    <meta property="og:description" content="Generic description" />
    <link rel="canonical" href="https://old.example/" />
  </head><body></body></html>`;
  const rendered = seo.replaceMeta(html, {
    title: 'Specific page',
    description: 'Specific description',
    canonical: 'https://dealscouted.com/deal/ABC',
    robots: 'noindex,follow',
  });
  assert.equal((rendered.match(/name="robots"/g) || []).length, 1);
  assert.equal((rendered.match(/property="og:title"/g) || []).length, 1);
  assert.equal((rendered.match(/property="og:description"/g) || []).length, 1);
  assert.equal((rendered.match(/rel="canonical"/g) || []).length, 1);
  assert.match(rendered, /content="noindex,follow"/);
  assert.match(rendered, /https:\/\/dealscouted\.com\/deal\/ABC/);
  assert.doesNotMatch(rendered, /old\.example/);
});
