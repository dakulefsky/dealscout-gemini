const { CATEGORY_RULES, classifyCategory, normalizeCategory } = require('./categoryClassifier');
const { isPublicDeal, isPriceFresh } = require('./publicDealPolicy');
const { uniqueQuantityFamilies } = require('./dealVariantPolicy');
const { oldestCheckedFirst, verificationAgeKey } = require('./verificationQueue');
const settings = require('./siteRuntimeSettingsService');

const TARGET_LIVE_DEALS = 6;
const STATE_KEY = 'rainforest_department_discovery';
const CATEGORY_MAX_AGE_MS = 7 * 86400000;
const department = deal => normalizeCategory(deal?.category) || 'Other';

function departmentStock(deals = [], nowSeconds = Math.floor(Date.now() / 1000)) {
  const stock = Object.fromEntries(CATEGORY_RULES.map(rule => [rule.category, 0]));
  for (const deal of uniqueQuantityFamilies(deals.filter(deal => isPublicDeal(deal, { nowSeconds })))) {
    const name = department(deal);
    stock[name] = (stock[name] || 0) + 1;
  }
  return stock;
}

function categoriesFromResponse(rows) {
  const ids = new Set();
  return (Array.isArray(rows) ? rows : []).flatMap(row => {
    const id = String(row?.category_id || '').trim();
    const name = String(row?.name || '').trim();
    if (!/^\d{1,20}$/.test(id) || !name || name.length > 64 || ids.has(id)) return [];
    ids.add(id);
    const category = classifyCategory({ rawCategory: name });
    return category && category !== 'Other' ? [{ id, category }] : [];
  }).slice(0, 200);
}

function planDiscovery(deals, state = {}, now = Date.now(), domain = 'amazon.com') {
  const stock = departmentStock(deals, Math.floor(now / 1000));
  const pulls = Number.isSafeInteger(state.pulls) && state.pulls >= 0 ? state.pulls : 0;
  const validCache = state.domain === domain && Number(state.observedAt) <= now && now - Number(state.observedAt) < CATEGORY_MAX_AGE_MS;
  const categories = validCache ? categoriesFromResponse((Array.isArray(state.categories) ? state.categories : []).map(row => ({ category_id: row?.id, name: row?.category }))) : [];
  const lastTargetAt = state.lastTargetAt && typeof state.lastTargetAt === 'object' ? state.lastTargetAt : {};
  // One in three pulls stays broad. Missing/stale taxonomy also falls back to broad.
  const targets = pulls % 3 === 0 ? [] : [...new Set(categories.map(row => row.category))]
    .filter(name => (stock[name] || 0) < TARGET_LIVE_DEALS)
    .sort((a, b) => (Number(lastTargetAt[a]) || 0) - (Number(lastTargetAt[b]) || 0) || (stock[a] || 0) - (stock[b] || 0) || a.localeCompare(b))
    .slice(0, 3);
  const categoryOffsets = validCache && state.categoryOffsets && typeof state.categoryOffsets === 'object' ? state.categoryOffsets : {};
  const targetIds = targets.flatMap(name => {
    const rows = categories.filter(row => row.category === name);
    const offset = Math.max(0, Number.parseInt(categoryOffsets[name], 10) || 0) % rows.length;
    return Array.from({ length: Math.min(2, rows.length) }, (_, i) => rows[(offset + i) % rows.length].id);
  });
  const categoryId = targetIds.join(',');
  const pageQueries = state.domain === domain && state.pageQueries && typeof state.pageQueries === 'object' ? state.pageQueries : {};
  const queryKey = categoryId ? targetIds.slice().sort().join(',') : 'broad';
  const savedCursor = pageQueries[queryKey] || {};
  const cursor = Number(savedCursor.at) <= now && now - Number(savedCursor.at) < CATEGORY_MAX_AGE_MS ? savedCursor : {};
  const totalPages = boundedPages(cursor.totalPages);
  const visits = Math.max(0, Number.parseInt(cursor.visits, 10) || 0);
  // Revisit the front page every third pull of this exact query for new arrivals.
  const page = visits % 3 === 0 ? 1 : Math.min(totalPages, Math.max(2, Number.parseInt(cursor.nextPage, 10) || 2));
  return { stock, pulls, categories, targets, categoryId, domain, lastTargetAt, categoryOffsets, pageQueries, queryKey, page, observedAt: validCache ? Number(state.observedAt) : 0 };
}

function boundedPages(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Math.min(1000, Number(value)) : 1;
}

async function prepareDiscovery(deals, domain = 'amazon.com') {
  let state = {};
  try { state = JSON.parse((await settings.get(STATE_KEY)).value || '{}'); }
  catch { /* Missing or corrupt planning state must not block a broad pull. */ }
  if (!state || typeof state !== 'object') state = {};
  return planDiscovery(deals, state, Date.now(), domain);
}

async function recordDiscovery(plan, rows, diagnostics = {}) {
  const now = Date.now();
  const learned = categoriesFromResponse(rows);
  const merged = new Map(plan.categories.map(row => [row.id, row]));
  learned.forEach(row => merged.set(row.id, row));
  const categories = [...merged.values()].slice(0, 200);
  const lastTargetAt = Object.fromEntries([...new Set(categories.map(row => row.category))].map(name => [name, plan.targets.includes(name) ? now : Number(plan.lastTargetAt[name]) || 0]));
  const categoryOffsets = { ...plan.categoryOffsets };
  for (const name of plan.targets) {
    const count = categories.filter(row => row.category === name).length;
    categoryOffsets[name] = count ? ((Number(categoryOffsets[name]) || 0) + 2) % count : 0;
  }
  const pageQueries = { ...plan.pageQueries };
  const totalPages = boundedPages(diagnostics.totalPages);
  const currentPage = boundedPages(diagnostics.currentPage || plan.page);
  pageQueries[plan.queryKey] = { totalPages, nextPage: currentPage >= totalPages ? 2 : Math.max(2, currentPage + 1), visits: ((Number(pageQueries[plan.queryKey]?.visits) || 0) + 1) % 3000000, at: now };
  const boundedQueries = Object.fromEntries(Object.entries(pageQueries).sort((a, b) => (Number(b[1]?.at) || 0) - (Number(a[1]?.at) || 0)).slice(0, 32));
  try {
    await settings.set(STATE_KEY, JSON.stringify({ domain: plan.domain, pulls: (plan.pulls + 1) % 3000000, observedAt: learned.length ? now : plan.observedAt, categories, lastTargetAt, categoryOffsets, pageQueries: boundedQueries, lastDiscovery: { ...diagnostics, at: now, categoryId: plan.categoryId || null, page: plan.page } }));
  } catch (error) { console.warn('[Department supply] Planning state could not be saved:', error.message); }
}

function departmentVerificationQueue(deals, nowSeconds = Math.floor(Date.now() / 1000), { includeFresh = true } = {}) {
  const stock = departmentStock(deals, nowSeconds);
  const groups = new Map();
  const eligible = includeFresh ? deals : deals.filter(deal => !isPriceFresh(deal, nowSeconds, 18 * 3600));
  for (const deal of oldestCheckedFirst(eligible, Math.max(1, eligible.length))) {
    const name = department(deal);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(deal);
  }
  const result = [];
  // Round-robin avoids one large or repeatedly failing department consuming the queue.
  while (groups.size) {
    const ordered = [...groups.keys()].sort((a, b) => (stock[a] || 0) - (stock[b] || 0)
      || verificationAgeKey(groups.get(a)[0]) - verificationAgeKey(groups.get(b)[0]) || a.localeCompare(b));
    for (const name of ordered) {
      result.push(groups.get(name).shift());
      if (!groups.get(name).length) groups.delete(name);
    }
  }
  return result;
}

module.exports = { TARGET_LIVE_DEALS, departmentStock, categoriesFromResponse, planDiscovery, prepareDiscovery, recordDiscovery, departmentVerificationQueue };
