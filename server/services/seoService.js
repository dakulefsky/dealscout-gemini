const { PUBLIC_PRICE_MAX_AGE_SECONDS } = require('./publicDealPolicy');

const PUBLIC_PRICE_MAX_AGE_HOURS = PUBLIC_PRICE_MAX_AGE_SECONDS / 3600;

function xmlEscape(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
}

function htmlEscape(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function siteBase(req, configuredOrigin) {
  if (configuredOrigin) return String(configuredOrigin).replace(/\/$/, '');
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'https';
  return `${protocol}://${req.get('host')}`.replace(/\/$/, '');
}

function priceCheckAgeHours(deal, nowMs = Date.now()) {
  const checkedAt = Number(deal?.price_check_at ?? deal?.priceCheckAt ?? 0);
  if (!Number.isFinite(checkedAt) || checkedAt <= 0) return Infinity;
  return Math.max(0, (nowMs - checkedAt * 1000) / 3600000);
}

function buildSitemap({ baseUrl, deals = [], categories = [], nowMs = Date.now(), maxDealAgeHours = PUBLIC_PRICE_MAX_AGE_HOURS }) {
  const freshDeals = deals.filter((deal) => priceCheckAgeHours(deal, nowMs) <= maxDealAgeHours);
  const urls = [
    { loc: `${baseUrl}/` },
    ...categories.map((c) => ({ loc: `${baseUrl}/category/${encodeURIComponent(c.slug)}` })),
    ...freshDeals.map((d) => ({ loc: `${baseUrl}/deal/${encodeURIComponent(d.id || d.asin)}`, lastmod: d.price_check_at ? new Date(Number(d.price_check_at) * 1000).toISOString() : undefined })),
    { loc: `${baseUrl}/disclosure` },
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${xmlEscape(u.lastmod)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>`;
}

function buildRobots(baseUrl) {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${baseUrl}/sitemap.xml\n`;
}

function replaceMeta(html, { title, description, canonical, robots = 'index,follow', jsonLd, image, nonce }) {
  let out = html;
  out = out.replace(/<title>.*?<\/title>/i, `<title>${htmlEscape(title)}</title>`);
  out = out.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${htmlEscape(description)}" />`);
  const additions = [
    `<meta name="robots" content="${htmlEscape(robots)}" />`,
    canonical ? `<link rel="canonical" href="${htmlEscape(canonical)}" />` : '',
    `<meta property="og:title" content="${htmlEscape(title)}" />`,
    `<meta property="og:description" content="${htmlEscape(description)}" />`,
    canonical ? `<meta property="og:url" content="${htmlEscape(canonical)}" />` : '',
    image ? `<meta property="og:image" content="${htmlEscape(image)}" />` : '',
    jsonLd ? `<script${nonce ? ` nonce="${htmlEscape(nonce)}"` : ''} type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n    ');
  return out.replace('</head>', `    ${additions}\n  </head>`);
}

function homeMeta(baseUrl) {
  return {
    title: 'DealScout — Amazon Deals & Price Drops',
    description: 'Find current Amazon price drops and standout deals, with recent price checks and clear savings.',
    canonical: `${baseUrl}/`,
  };
}

function categoryMeta(baseUrl, category) {
  const name = category?.name || 'Amazon Deals';
  const slug = category?.slug || 'other';
  const canonical = `${baseUrl}/category/${encodeURIComponent(slug)}`;
  const description = category?.description
    ? `Browse current ${name} deals and price drops on DealScout. ${category.description}`
    : `Browse current ${name} deals and price drops on DealScout, with recently verified prices and rotating live offers.`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${name} Deals & Price Drops`,
        description,
        url: canonical,
        isPartOf: { '@type': 'WebSite', name: 'DealScout', url: `${baseUrl}/` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'DealScout', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name, item: canonical },
        ],
      },
    ],
  };
  return { title: `${name} Deals & Price Drops — DealScout`, description, canonical, jsonLd };
}

function dealMeta(baseUrl, deal, nowMs = Date.now()) {
  const savings = Math.max(0, Number(deal.original_price || 0) - Number(deal.sale_price || 0));
  const sale = Number(deal.sale_price || 0).toFixed(2);
  const title = `${deal.title} — $${sale} | DealScout`;
  const ageHours = priceCheckAgeHours(deal, nowMs);
  const fresh = ageHours <= PUBLIC_PRICE_MAX_AGE_HOURS;
  const freshnessText = fresh
    ? 'Price checked recently within DealScout’s 24-hour public freshness window; confirm final price and availability on Amazon.'
    : 'Last observed price may be stale because it is outside DealScout’s 24-hour public freshness window; confirm the current price and availability on Amazon.';
  const description = `${deal.discount_percent || 0}% off${savings > 0 ? `, save $${savings.toFixed(2)}` : ''}. ${freshnessText}`;
  const canonical = `${baseUrl}/deal/${encodeURIComponent(deal.id || deal.asin)}`;
  const offer = {
    '@type': 'Offer',
    url: canonical,
    priceCurrency: 'USD',
    price: Number(deal.sale_price || 0).toFixed(2),
  };
  if (fresh) offer.availability = 'https://schema.org/InStock';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: deal.title,
    sku: deal.asin,
    image: deal.image_url || undefined,
    offers: offer,
  };
  return { title, description, canonical, image: deal.image_url || undefined, jsonLd, robots: fresh ? 'index,follow' : 'noindex,follow' };
}

module.exports = { siteBase, priceCheckAgeHours, buildSitemap, buildRobots, replaceMeta, homeMeta, categoryMeta, dealMeta };
