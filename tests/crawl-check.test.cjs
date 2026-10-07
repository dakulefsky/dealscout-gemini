const test = require('node:test');
const assert = require('node:assert/strict');
const base = 'https://dealscouted.com';
function fixture({ scheduled = false, broken = false, outage = false } = {}) {
  return async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/') return new Response('data-server-crawl-content="home"', { status: outage || scheduled ? 503 : 200, headers: scheduled ? { 'x-dealscout-closure': 'scheduled' } : {} });
    if (pathname === '/robots.txt') return new Response(`Sitemap: ${base}/sitemap.xml`);
    if (pathname === '/sitemap.xml') return new Response(`<urlset><loc>${base}/</loc><loc>${base}/deal/ABC</loc></urlset>`);
    return new Response(`<main data-server-crawl-content="deal"></main><link rel="canonical" href="${url}">`, { status: broken ? 503 : 200 });
  };
}
test('crawl monitor fails on unexpected outages and product errors', async () => {
  const { checkCrawl } = await import('../scripts/crawl-check.mjs');
  assert.equal((await checkCrawl(base, fixture())).checked, 4);
  await assert.rejects(checkCrawl(base, fixture({ broken: true })), /ABC returned HTTP 503/);
  await assert.rejects(checkCrawl(base, fixture({ outage: true })), /Homepage returned HTTP 503/);
});
test('scheduled closure skips shopper pages while checking robots and sitemap', async () => {
  const { checkCrawl } = await import('../scripts/crawl-check.mjs');
  const result = await checkCrawl(base, fixture({ scheduled: true }));
  assert.equal(result.scheduledClosure, true);
  assert.equal(result.checked, 3);
});
