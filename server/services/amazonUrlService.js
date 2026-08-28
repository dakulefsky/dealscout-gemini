const AMAZON_SHORT_HOSTS = new Set(['amzn.to', 'a.co']);
const AMAZON_DOMAIN_RE = /(^|\.)amazon\.(com|ca|com\.au|com\.br|com\.mx|co\.uk|co\.jp|de|fr|it|es|in|nl|se|pl|sg|ae|sa|tr|be)$/i;

function extractAsin(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) return trimmed.toUpperCase();

  const patterns = [
    /(?:\/dp\/|\/gp\/product\/|\/ASIN\/|\/gp\/aw\/d\/|\/d\/|\/o\/ASIN\/|\/offer-listing\/|\/product-reviews\/)([A-Z0-9]{10})/i,
    /[?&;](?:asins|asin|placement|creativeASIN|pd_rd_i)=([A-Z0-9]{10})/i,
    /(?:asins%3D|asin%3D|placement%3D|creativeASIN%3D)([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\/deal\/[a-zA-Z0-9_-]+\?.*asin=([A-Z0-9]{10})/i,
    /\b(B0[A-Z0-9]{8})\b/i,
  ];

  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match?.[1]) {
      const candidate = match[1].toUpperCase();
      if (/^[A-Z0-9]{10}$/.test(candidate)) return candidate;
    }
  }
  return null;
}

function isAmazonUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    return AMAZON_SHORT_HOSTS.has(host) || AMAZON_DOMAIN_RE.test(host);
  } catch {
    return false;
  }
}

function formatAffiliateUrl(url, associateTag = process.env.AMAZON_ASSOCIATE_TAG) {
  if (!url || typeof url !== 'string') return url;
  if (!isAmazonUrl(url)) throw new Error('Affiliate URLs must use an Amazon-owned host');
  const parsed = new URL(url);
  const tag = String(associateTag || '').trim();
  if (!tag) return parsed.toString();
  parsed.searchParams.set('tag', tag);
  return parsed.toString();
}

module.exports = { extractAsin, isAmazonUrl, formatAffiliateUrl };
