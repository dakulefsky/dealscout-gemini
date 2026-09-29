// Only explicit item counts are ignored. Model numbers, capacities, colours,
// accessories and the rest of the title must still match exactly.
const COUNTED_ITEM = '[0-9]+[ -]+(camera|cameras|piece|pieces|count|ct|pack|packs|unit|units|item|items)';
const PACK_OF = '(pack|set|box)[ ]+of[ ]+[0-9]+';

function quantityFamilyKey(deal) {
  const title = String(deal.title || '').toLowerCase().replace(/[–—]/g, '-');
  const counted = new RegExp(`\\b${COUNTED_ITEM}\\b`, 'g');
  const packOf = new RegExp(`\\b${PACK_OF}\\b`, 'g');
  if (!counted.test(title) && !packOf.test(title)) return null;
  const normalized = title
    .replace(new RegExp(`\\b${COUNTED_ITEM}\\b`, 'g'), '$1')
    .replace(new RegExp(`\\b${PACK_OF}\\b`, 'g'), '$1')
    .replace(/[^a-z0-9+]+/g, ' ').trim();
  if (!normalized) return null;
  return `${String(deal.category || '').toLowerCase()}:${normalized}`;
}

function uniqueQuantityFamilies(sortedDeals) {
  const seen = new Set();
  return sortedDeals.filter((deal) => {
    const key = quantityFamilyKey(deal);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// PostgreSQL word boundaries use \m and \M, rather than JavaScript's \b.
const COUNTED_SQL = `\\m${COUNTED_ITEM}\\M`;
const PACK_SQL = `\\m${PACK_OF}\\M`;
const TITLE_SQL = "replace(replace(lower(COALESCE(title, '')), '–', '-'), '—', '-')";
const NORMALIZED_SQL = `trim(regexp_replace(regexp_replace(regexp_replace(${TITLE_SQL}, '${COUNTED_SQL}', '\\1', 'g'), '${PACK_SQL}', '\\1', 'g'), '[^a-z0-9+]+', ' ', 'g'))`;
const QUANTITY_FAMILY_SQL = `CASE WHEN ${TITLE_SQL} ~ '${COUNTED_SQL}' OR ${TITLE_SQL} ~ '${PACK_SQL}' THEN 'family:' || lower(COALESCE(category, '')) || ':' || ${NORMALIZED_SQL} ELSE 'asin:' || asin END`;

module.exports = { quantityFamilyKey, uniqueQuantityFamilies, QUANTITY_FAMILY_SQL };
