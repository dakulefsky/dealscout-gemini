const AMAZON_SHORT_HOSTS = new Set(['amzn.to', 'a.co']);
const AMAZON_DOMAIN_RE = /(^|\.)amazon\.(com|ca|com\.au|com\.br|com\.mx|co\.uk|co\.jp|de|fr|it|es|in|nl|se|pl|sg|ae|sa|tr|be)$/i;

export function isAmazonOwnedUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    return AMAZON_SHORT_HOSTS.has(host) || AMAZON_DOMAIN_RE.test(host);
  } catch {
    return false;
  }
}
