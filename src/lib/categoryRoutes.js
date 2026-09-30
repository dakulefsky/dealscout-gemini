const CATEGORY_SLUGS = new Map([
  ['electronics', 'electronics'],
  ['home & kitchen', 'home-kitchen'],
  ['sports & outdoors', 'sports-outdoors'],
  ['health & beauty', 'health-beauty'],
  ['toys & games', 'toys-games'],
  ['baby', 'baby'],
  ['pet supplies', 'pet-supplies'],
  ['automotive', 'automotive'],
  ['tools & home improvement', 'tools-home-improvement'],
  ['office & school', 'office-school'],
  ['clothing & accessories', 'clothing-accessories'],
  ['grocery', 'grocery'],
  ['other', 'other'],
]);

export function categorySlugFromName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  const canonical = CATEGORY_SLUGS.get(normalized);
  if (canonical) return canonical;
  return normalized
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 80);
}

export function categoryPathFromName(value) {
  const slug = categorySlugFromName(value);
  return slug ? `/category/${encodeURIComponent(slug)}` : '/';
}
