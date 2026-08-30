const axios = require('axios');
const { imageCandidates } = require('./rainforestImage');

const ENDPOINT = 'https://api.rainforestapi.com/request';

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
  const categoryName = cleanText(item.category?.name) || cleanText(item.category) || cleanText(item.search_alias) || 'Amazon';

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
    availability: item.availability?.raw || item.buybox_winner?.availability?.raw || null,
    dealBadge: item.deal_badge || item.badge || null,
    sourceProvider: 'RAINFOREST',
    sourceVerified: true,
    rawSourceData: `Rainforest API deals feed | ASIN: ${asin}`,
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

async function fetchStrictRainforestDeals({ amazonDomain = 'amazon.com', dealType = null, categoryId = null, maxResults = 15, minDiscount = 10 } = {}) {
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

  const items = Array.isArray(data.deals_results) ? data.deals_results : (Array.isArray(data.deals) ? data.deals : []);
  const normalized = items.map(normalizeDeal).filter(Boolean).filter((deal) => deal.discountPercent >= minDiscount);
  return dedupeDeals(normalized).sort((a, b) => b.discountPercent - a.discountPercent || b.savingsAmount - a.savingsAmount).slice(0, maxResults);
}

module.exports = { fetchStrictRainforestDeals, normalizeDeal, dedupeDeals };
