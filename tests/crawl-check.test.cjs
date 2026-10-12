const test = require('node:test');
const assert = require('node:assert/strict');
const base = 'https://dealscouted.com';
function fixture({ scheduled = false, broken = false, outage = false, collectionError, missingProductLinks = false, emptyCollections = false, unpublishedGuide = false } = {}) {
  return async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/') return new Response('data-server-crawl-content="home"', { status: outage || scheduled ? 503 : 200, headers: scheduled ? { 'x-dealscout-closure': 'scheduled' } : {} });
    if (pathname === '/robots.txt') return new Response(`Sitemap: ${base}/sitemap.xml`);
    if (pathname === '/sitemap.xml') return new Response(`<urlset><loc>${base}/</loc><loc>${base}/deal/ABC</loc><loc>${base}/about</loc>${unpublishedGuide ? '' : `<loc>${base}/guides/amazon-deal-checklist</loc>`}</urlset>`);
    if (pathname.startsWith('/deals/')) return new Response(`<main data-server-crawl-content="collection">${missingProductLinks || emptyCollections ? '' : '<a href="/deal/ABC">Current deal</a>'}</main><link rel="canonical" href="${url}"><meta name="robots" content="${emptyCollections ? 'noindex' : 'index'},follow">`, { status: pathname === collectionError ? 503 : 200 });
    return new Response(`<main data-server-crawl-content="deal"></main><link rel="canonical" href="${url}">`, { status: broken && pathname.startsWith('/deal/') ? 503 : 200 });
  };
}
test('crawl monitor fails on unexpected outages and product errors', async () => {
  const { checkCrawl } = await import('../scripts/crawl-check.mjs');
  const collections = require('../shared/dealCollections.json');
  assert.equal((await checkCrawl(base, fixture())).checked, 6 + collections.length);
  await assert.rejects(checkCrawl(base, fixture({ broken: true })), /ABC returned HTTP 503/);
  await assert.rejects(checkCrawl(base, fixture({ outage: true })), /Homepage returned HTTP 503/);
});
test('crawl monitor checks new product collections absent from the sitemap and catches empty indexable HTML', async () => {
  const { checkCrawl } = await import('../scripts/crawl-check.mjs');
  await assert.rejects(checkCrawl(base, fixture({ collectionError: '/deals/headphone-deals-under-200' })), /headphone-deals-under-200 returned HTTP 503/);
  await assert.rejects(checkCrawl(base, fixture({ missingProductLinks: true })), /indexable but has no server-rendered product links/);
  const result = await checkCrawl(base, fixture({ emptyCollections: true }));
  assert.equal(result.collectionsChecked, require('../shared/dealCollections.json').length);
  assert.equal(result.emptyCollections, result.collectionsChecked);
});
test('scheduled closure skips shopper pages while checking robots and sitemap', async () => {
  const { checkCrawl } = await import('../scripts/crawl-check.mjs');
  const result = await checkCrawl(base, fixture({ scheduled: true }));
  assert.equal(result.scheduledClosure, true);
  assert.equal(result.checked, 3);
});
test('pre-deployment checks report unpublished guides while production requires sitemap inclusion', async () => {
  const { checkCrawl } = await import('../scripts/crawl-check.mjs');
  await assert.rejects(checkCrawl(base, fixture({ unpublishedGuide: true })), /missing the buying guide/);
  const result = await checkCrawl(base, fixture({ unpublishedGuide: true }), { allowUnpublishedGuides: true });
  assert.equal(result.guidesChecked, 0);
  assert.deepEqual(result.unpublishedGuides, [`${base}/guides/amazon-deal-checklist`]);
});
