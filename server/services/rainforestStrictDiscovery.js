const axios = require('axios');
const { imageCandidates } = require('./rainforestImage');
const { classifyCategory, normalizeCategory } = require('./categoryClassifier');

const ENDPOINT = 'https://api.rainforestapi.com/request';
const SINGLE_PAGE_NEW_DEAL_FLOOR = 25;
const REVIEWABLE_DISCOUNT_FLOOR = 12;

function moneyValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value && typeof value === 'object' && Number.isFinite(Number(value.value))) return Number(value.value);
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function affiliateUrl(asin) {
  const tag = process.env.AMAZON_ASSOCIATE_TAG;
  if (!tag) throw new Error('AMAZON_ASSOCIATE_TAG is required for Rainforest live deals');
  return `https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(tag)}`;
}

function isUnavailableDeal(deal) {
  const availability = cleanText(deal?.availability).toLowerCase();
  return /out of stock|unavailable|no featured offers/.test(availability);
}

function normalizeDeal(item) {
  const asin = String(item?.asin || '').trim().toUpperCase();
  const title = cleanText(item?.title);
  if (!/^[A-Z0-9]{10}$/.test(asin) || !title) return null;

  const salePrice = moneyValue(item.deal_price) ?? moneyValue(item.current_price) ?? moneyValue(item.price);
  const originalPrice = moneyValue(item.list_price) ?? moneyValue(item.rrp);
  if (!Number.isFinite(salePrice) || salePrice <= 0) return null;
  if (!Number.isFinite(originalPrice) || originalPrice <= salePrice) return null;

  const discountPercent = Number((((originalPrice - salePrice) / originalPrice) * 100).toFixed(1));
  const gallery = imageCandidates(item.main_image, item.image, item.images, item.images_flat);
  const rawCategoryName = cleanText(item.category?.name) || cleanText(item.category) || '';
  const searchAlias = cleanText(item.search_alias) || '';
  const categoryName = classifyCategory({ rawCategory: rawCategoryName, searchAlias, title });
  const availability = cleanText(item.availability?.raw || item.buybox_winner?.availability?.raw) || null;

  return {
    asin,
    title,
    category: categoryName,
    originalPrice,
    salePrice,
    discountPercent,
    savingsAmount: Number((originalPrice - salePrice).toFixed(2)),
    imageUrl: gallery[0] || null,
    imageGallery: gallery,
    productUrl: affiliateUrl(asin),
    rawProductUrl: item.link || `https://www.amazon.com/dp/${asin}`,
    rating: Number(item.rating) || null,
    ratingsTotal: Number(item.ratings_total) || 0,
    reviews: [],
    isPrime: item.is_prime === true || item.buybox_winner?.is_prime === true,
    availability,
    dealBadge: item.deal_badge || item.badge || null,
    sourceProvider: 'RAINFOREST',
    sourceVerified: true,
    rawSourceData: `Rainforest API deals feed | ASIN: ${asin} | rawCategory=${rawCategoryName || 'unknown'} | searchAlias=${searchAlias || 'unknown'} | normalizedCategory=${categoryName}`,
  };
}

function dedupeDeals(items) {
  const byAsin = new Map();
  for (const deal of items) {
    const existing = byAsin.get(deal.asin);
    if (!existing || deal.discountPercent > existing.discountPercent || (deal.discountPercent === existing.discountPercent && deal.salePrice < existing.salePrice)) {
      byAsin.set(deal.asin, deal);
    }
  }
  return [...byAsin.values()];
}

function selectBalancedDeals(rankedDeals = [], maxResults = 15) {
  const limit = Math.max(1, Number.parseInt(maxResults, 10) || 15);
  if (rankedDeals.length <= limit) return rankedDeals.slice(0, limit);
  const maxPerCategory = Math.max(2, Math.ceil(limit / 4));
  const counts = new Map();
  const selected = [];
  const selectedAsins = new Set();

  for (const deal of rankedDeals) {
    if (selected.length >= limit) break;
    const category = normalizeCategory(deal.category) || 'Other';
    const count = counts.get(category) || 0;
    if (count >= maxPerCategory) continue;
    selected.push(deal);
    selectedAsins.add(deal.asin);
    counts.set(category, count + 1);
  }

  if (selected.length < limit) {
    for (const deal of rankedDeals) {
      if (selected.length >= limit) break;
      if (selectedAsins.has(deal.asin)) continue;
      selected.push(deal);
      selectedAsins.add(deal.asin);
    }
  }

  return selected;
}

function selectDealsForIngestion(rankedDeals = [], maxNewResults = 15, refreshExistingAsins = []) {
  const existingSet = new Set((refreshExistingAsins || []).map((asin) => String(asin || '').trim().toUpperCase()).filter(Boolean));
  const refreshMatches = rankedDeals.filter((deal) => existingSet.has(deal.asin));
  const refreshIds = new Set(refreshMatches.map((deal) => deal.asin));
  const newCandidates = rankedDeals.filter((deal) => !refreshIds.has(deal.asin));
  const selectedNew = selectBalancedDeals(newCandidates, maxNewResults);
  return [...refreshMatches, ...selectedNew];
}

async function fetchStrictRainforestDeals({ amazonDomain = 'amazon.com', dealType = null, categoryId = null, maxResults = 15, minDiscount = 10, refreshExistingAsins = [] } = {}) {
  const apiKey = process.env.RAINFOREST_API_KEY;
  if (!apiKey) throw new Error('RAINFOREST_API_KEY is not configured');

  const params = { api_key: apiKey, amazon_domain: amazonDomain, type: 'deals' };
  if (dealType) params.deal_type = dealType;
  if (categoryId) params.category_id = categoryId;

  const response = await axios.get(ENDPOINT, {
    params,
    timeout: 20000,
    headers: { Accept: 'application/json', 'User-Agent': 'DealScout-Service/1.0' },
  });

  const data = response.data || {};
  if (data.request_info?.success === false) throw new Error(data.request_info.message || 'Rainforest deals request failed');

  // Keep this to one paid deals page. Broaden only what we retain from that already-paid response.
  const effectiveMaxResults = Math.max(SINGLE_PAGE_NEW_DEAL_FLOOR, Number(maxResults) || 0);
  const effectiveMinDiscount = Math.min(REVIEWABLE_DISCOUNT_FLOOR, Math.max(0, Number(minDiscount) || 0));
  const items = Array.isArray(data.deals_results) ? data.deals_results : (Array.isArray(data.deals) ? data.deals : []);
  const normalized = items
    .map(normalizeDeal)
    .filter(Boolean)
    .filter((deal) => !isUnavailableDeal(deal))
    .filter((deal) => deal.discountPercent >= effectiveMinDiscount);
  const ranked = dedupeDeals(normalized).sort((a, b) => b.discountPercent - a.discountPercent || b.savingsAmount - a.savingsAmount);
  return selectDealsForIngestion(ranked, effectiveMaxResults, refreshExistingAsins);
}

module.exports = {
  fetchStrictRainforestDeals,
  normalizeDeal,
  normalizeCategory,
  dedupeDeals,
  selectBalancedDeals,
  selectDealsForIngestion,
  isUnavailableDeal,
  SINGLE_PAGE_NEW_DEAL_FLOOR,
  REVIEWABLE_DISCOUNT_FLOOR,
};
