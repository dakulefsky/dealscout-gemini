const { PUBLIC_PRICE_MAX_AGE_SECONDS, hasValidPricePair } = require('./publicDealPolicy');

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
  const latestCheck = freshDeals.reduce((latest, deal) => Math.max(latest, Number(deal.price_check_at || 0)), 0);
  const latestByCategory = new Map();
  for (const deal of freshDeals) {
    const key = String(deal.category || '').trim().toLowerCase();
    const checkedAt = Number(deal.price_check_at || 0);
    if (key && checkedAt > Number(latestByCategory.get(key) || 0)) latestByCategory.set(key, checkedAt);
  }
  const iso = (seconds) => Number(seconds) > 0 ? new Date(Number(seconds) * 1000).toISOString() : undefined;
  const urls = [
    { loc: `${baseUrl}/`, lastmod: iso(latestCheck) },
    ...categories.map((c) => ({ loc: `${baseUrl}/category/${encodeURIComponent(c.slug)}`, lastmod: iso(latestByCategory.get(String(c.name || '').trim().toLowerCase())) })),
    ...freshDeals.map((d) => ({ loc: `${baseUrl}/deal/${encodeURIComponent(d.id || d.asin)}`, lastmod: iso(d.price_check_at) })),
    { loc: `${baseUrl}/disclosure` },
    { loc: `${baseUrl}/privacy` },
    { loc: `${baseUrl}/support` },
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

  // The base Vite shell contains generic crawler/social tags. Remove those before
  // injecting route-specific values so crawlers never receive conflicting metadata.
  out = out
    .replace(/\s*<meta\s+name=["']robots["'][^>]*>/gi, '')
    .replace(/\s*<link\s+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+property=["']og:(?:title|description|url|image)["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+name=["']twitter:(?:title|description|image)["'][^>]*>/gi, '');

  const additions = [
    `<meta name="robots" content="${htmlEscape(robots)}" />`,
    canonical ? `<link rel="canonical" href="${htmlEscape(canonical)}" />` : '',
    `<meta property="og:title" content="${htmlEscape(title)}" />`,
    `<meta property="og:description" content="${htmlEscape(description)}" />`,
    canonical ? `<meta property="og:url" content="${htmlEscape(canonical)}" />` : '',
    image ? `<meta property="og:image" content="${htmlEscape(image)}" />` : '',
    `<meta name="twitter:title" content="${htmlEscape(title)}" />`,
    `<meta name="twitter:description" content="${htmlEscape(description)}" />`,
    image ? `<meta name="twitter:image" content="${htmlEscape(image)}" />` : '',
    jsonLd ? `<script${nonce ? ` nonce="${htmlEscape(nonce)}"` : ''} type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n    ');
  return out.replace('</head>', `    ${additions}\n  </head>`);
}

function homeMeta(baseUrl, categories = []) {
  const canonical = `${baseUrl}/`;
  const itemListElement = categories.map((category, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: category.name,
    url: `${baseUrl}/category/${encodeURIComponent(category.slug)}`,
  }));
  return {
    title: 'DealScout — Amazon Deals by Category & Price Drops',
    description: 'Shop fresh Amazon deals by category, with recently verified prices, clear savings, and a small edit of standout discounts.',
    canonical,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'DealScout', url: canonical },
        { '@type': 'CollectionPage', name: 'Amazon deals by category', url: canonical, mainEntity: { '@type': 'ItemList', itemListElement } },
      ],
    },
  };
}

function categoryMeta(baseUrl, category, deals = []) {
  const name = category?.name || 'Amazon Deals';
  const slug = category?.slug || 'other';
  const canonical = `${baseUrl}/category/${encodeURIComponent(slug)}`;
  const description = category?.description
    ? `Browse current ${name} deals and price drops on DealScout. ${category.description}`
    : `Browse current ${name} deals and price drops on DealScout, with recently verified prices and rotating live offers.`;
  const dealItems = (deals || []).slice(0, 12).map((deal, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: deal.title,
    url: `${baseUrl}/deal/${encodeURIComponent(deal.id || deal.asin)}`,
  }));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${name} Deals & Price Drops`,
        description,
        url: canonical,
        isPartOf: { '@type': 'WebSite', name: 'DealScout', url: `${baseUrl}/` },
        ...(dealItems.length ? { mainEntity: { '@type': 'ItemList', itemListElement: dealItems } } : {}),
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
  const ageHours = priceCheckAgeHours(deal, nowMs);
  const fresh = ageHours <= PUBLIC_PRICE_MAX_AGE_HOURS && hasValidPricePair(deal);
  const canonical = `${baseUrl}/deal/${encodeURIComponent(deal.id || deal.asin)}`;
  const image = deal.image_url || undefined;

  if (!fresh) {
    return {
      title: `${deal.title} | DealScout`,
      description: 'This deal is waiting for a fresh verified price. Confirm the current price and availability on Amazon.',
      canonical,
      image,
      robots: 'noindex,follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: deal.title,
        sku: deal.asin,
        image,
      },
    };
  }

  const original = Number(deal.original_price || 0);
  const current = Number(deal.sale_price || 0);
  const savings = Math.max(0, original - current);
  const discountPercent = Number((((original - current) / original) * 100).toFixed(1));
  const sale = current.toFixed(2);
  const title = `${deal.title} — $${sale} | DealScout`;
  const description = `${discountPercent}% off${savings > 0 ? `, save $${savings.toFixed(2)}` : ''}. Price checked recently within DealScout’s 24-hour public freshness window; confirm final price and availability on Amazon.`;
  const offer = {
    '@type': 'Offer',
    url: canonical,
    priceCurrency: 'USD',
    price: sale,
    availability: 'https://schema.org/InStock',
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: deal.title,
    sku: deal.asin,
    image,
    offers: offer,
  };
  return { title, description, canonical, image, jsonLd, robots: 'index,follow' };
}

module.exports = { siteBase, priceCheckAgeHours, buildSitemap, buildRobots, replaceMeta, homeMeta, categoryMeta, dealMeta };
