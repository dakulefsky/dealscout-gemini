// Fixed product-title rules keep accessories out of product buying collections.
// All SQL patterns are bound parameters; request text never becomes SQL or regex.
const RULES = Object.freeze({
  headphones: {
    include: /\bheadphones?\b/i,
    exclude: /\b(replacement (ear ?pads?|cable|headband)|headphone stands?|headphones? (stand|case|cover|cable)|case for|cover for)\b/i,
  },
  'gaming-monitors': {
    include: /\bgaming monitor\b/i,
    exclude: /\b(monitor (stand|arm|mount)|stand for|mount for|replacement)\b/i,
  },
  'coffee-makers': {
    include: /\b(coffee|espresso)\b.*\b(maker|machine)\b/i,
    exclude: /\b(replacement (carafe|filter)|paper filters?|coffee pods?|coffee capsules?|descaler|descaling|cleaning tablets?|coffee table)\b/i,
  },
});
function normalizeProductType(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !Object.hasOwn(RULES, value)) throw new Error('Invalid product type');
  return value;
}
function matchesProductType(type, title) {
  const rule = RULES[normalizeProductType(type)];
  if (!rule) return true;
  const text = String(title || '');
  return rule.include.test(text) && !rule.exclude.test(text);
}
function productTypeSql(type, params) {
  const rule = RULES[normalizeProductType(type)];
  if (!rule) return null;
  // PostgreSQL's word-boundary escape is \y, equivalent to JS \b here.
  const include = `$${params.push(rule.include.source.replace(/\\b/g, '\\y'))}`;
  const exclude = `$${params.push(rule.exclude.source.replace(/\\b/g, '\\y'))}`;
  return `(COALESCE(title, '') ~* ${include} AND COALESCE(title, '') !~* ${exclude})`;
}
module.exports = { normalizeProductType, matchesProductType, productTypeSql };
