import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Only visit the public origin and a bounded sample; never call discovery APIs.
export async function checkCrawl(base = 'https://dealscouted.com', fetchImpl = globalThis.fetch) {
  const origin = new URL(base).origin;
  async function get(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchImpl(url, { signal: controller.signal, redirect: 'manual', headers: { 'User-Agent': 'DealScout-Crawl-Check/1' } });
      const text = await response.text();
      return { status: response.status, text, headers: response.headers };
    } finally { clearTimeout(timer); }
  }
  const home = await get(origin + '/');
  const scheduled = home.status === 503 && home.headers.get('x-dealscout-closure') === 'scheduled';
  if (home.status !== 200 && !scheduled) throw new Error(`Homepage returned HTTP ${home.status}`);
  const robots = await get(origin + '/robots.txt');
  if (robots.status !== 200 || !robots.text.includes(`Sitemap: ${origin}/sitemap.xml`)) throw new Error('robots.txt is unavailable or has the wrong sitemap');
  const sitemap = await get(origin + '/sitemap.xml');
  if (sitemap.status !== 200 || !sitemap.text.includes('<urlset')) throw new Error('Sitemap is unavailable or malformed');
  const urls = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  if (!urls.includes(origin + '/')) throw new Error('Sitemap is missing the homepage');
  for (const url of urls) if (new URL(url).origin !== origin) throw new Error('Sitemap contains another origin');
  if (scheduled) return { scheduledClosure: true, checked: 3, sitemapUrls: urls.length };
  if (!home.text.includes('data-server-crawl-content="home"')) throw new Error('Homepage has no crawlable content');
  const sampled = [
    ...urls.filter((u) => new URL(u).pathname.startsWith('/category/')).slice(0, 2),
    ...urls.filter((u) => new URL(u).pathname.startsWith('/deal/')).slice(0, 3),
    ...urls.filter((u) => new URL(u).pathname.startsWith('/deals/')).slice(0, 1),
  ];
  let expired = 0;
  for (const url of sampled) {
    const page = await get(url);
    // Cached sitemap entries can expire before the next price check.
    if (page.status === 404 && new URL(url).pathname.startsWith('/deal/')) { expired += 1; continue; }
    if (page.status !== 200) throw new Error(`${url} returned HTTP ${page.status}`);
    if (!page.text.includes('data-server-crawl-content=')) throw new Error(`${url} has no crawlable content`);
    if (!page.text.includes(`href="${url}"`)) throw new Error(`${url} has no matching canonical`);
  }
  return { scheduledClosure: false, checked: sampled.length + 3, expiredProductLinks: expired, sitemapUrls: urls.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkCrawl().then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
