const { isPublicDeal, checkedAtSeconds, discountPercent } = require('./publicDealPolicy');
const { htmlEscape } = require('./seoService');
const escape = value => htmlEscape([...String(value ?? '')].map(character => {
  const code = character.codePointAt(0);
  const allowed = code === 9 || code === 10 || code === 13
    || (code >= 32 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd)
    || (code >= 0x10000 && code <= 0x10ffff);
  return allowed ? character : ' ';
}).join(''));

function buildDealRss({ baseUrl, deals = [], category = null, nowMs = Date.now() }) {
  const origin = new URL(baseUrl).origin;
  const feedUrl = `${origin}/feed.xml${category ? `?category=${encodeURIComponent(category.slug)}` : ''}`;
  const title = category ? `DealScout — ${category.name} deals` : 'DealScout — New verified Amazon deals';
  const pageUrl = `${origin}${category ? `/category/${encodeURIComponent(category.slug)}` : '/'}`;
  const items = deals.filter(deal => (deal.id || deal.asin) && String(deal.title || '').trim() && isPublicDeal(deal, { nowSeconds: Math.floor(nowMs / 1000) })).slice(0, 24);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${escape(title)}</title><link>${escape(pageUrl)}</link>
<description>New deals from DealScout's approved catalog. Prices are checked snapshots, not a guarantee of current availability. Confirm the selected offer on Amazon.</description>
<language>en-us</language><lastBuildDate>${new Date(nowMs).toUTCString()}</lastBuildDate><ttl>60</ttl>
<atom:link href="${escape(feedUrl)}" rel="self" type="application/rss+xml" />
${items.map(deal => {
    const url = `${origin}/deal/${encodeURIComponent(deal.id || deal.asin)}`;
    const price = Number(deal.sale_price ?? deal.salePrice).toFixed(2);
    const reference = Number(deal.original_price ?? deal.originalPrice).toFixed(2);
    const checked = new Date(checkedAtSeconds(deal) * 1000).toUTCString();
    const description = `Checked price: $${price}. Listing reference price: $${reference} (${Math.round(discountPercent(deal))}% off that reference). Price checked ${checked}. Prices and availability can change; confirm the final offer on Amazon. DealScout earns commissions from qualifying purchases through links on its site.`;
    const created = Number(deal.created_at ?? 0);
    const published = Number.isFinite(created) && created > 0 && created * 1000 <= nowMs ? `<pubDate>${new Date(created * 1000).toUTCString()}</pubDate>` : '';
    return `<item><title>${escape(deal.title)}</title><link>${escape(url)}</link><guid isPermaLink="true">${escape(url)}</guid>${published}<category>${escape(deal.category || '')}</category><description>${escape(description)}</description></item>`;
  }).join('\n')}
</channel></rss>`;
}
module.exports = { buildDealRss };
