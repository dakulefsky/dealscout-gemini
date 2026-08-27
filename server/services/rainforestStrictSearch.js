const axios = require('axios');

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

function normalizeSearchResult(item = {}) {
  const asin = String(item.asin || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin) || !item.title) return null;

  const salePrice = moneyValue(item.price) ?? moneyValue(item.current_price);
  const originalPrice = moneyValue(item.rrp) ?? moneyValue(item.list_price);
  const hasPricePair = Number.isFinite(salePrice) && salePrice > 0 && Number.isFinite(originalPrice) && originalPrice > salePrice;

  return {
    asin,
    title: item.title,
    salePrice: Number.isFinite(salePrice) && salePrice > 0 ? salePrice : null,
    originalPrice: hasPricePair ? originalPrice : null,
    discountPercent: hasPricePair ? Number((((originalPrice - salePrice) / originalPrice) * 100).toFixed(1)) : null,
    imageUrl: item.image?.link || item.image || item.main_image?.link || null,
    productUrl: item.link || `https://www.amazon.com/dp/${asin}`,
    rating: Number(item.rating) || null,
    ratingsTotal: Number(item.ratings_total) || 0,
    sourceProvider: 'RAINFOREST',
    sourceVerified: true,
    hasVerifiedDealPricePair: hasPricePair,
  };
}

async function searchRainforestStrict(searchTerm, { amazonDomain = 'amazon.com', maxResults = 10, page = 1, sortBy = 'featured' } = {}) {
  const query = String(searchTerm || '').trim();
  if (!query) throw new Error('Search term is required');
  const apiKey = process.env.RAINFOREST_API_KEY;
  if (!apiKey) throw new Error('RAINFOREST_API_KEY is not configured');

  const response = await axios.get(ENDPOINT, {
    params: {
      api_key: apiKey,
      amazon_domain: amazonDomain,
      type: 'search',
      search_term: query,
      page,
      sort_by: sortBy,
    },
    timeout: 20000,
    headers: { Accept: 'application/json', 'User-Agent': 'DealScout-Service/1.0' },
  });

  const data = response.data || {};
  if (data.request_info?.success === false) throw new Error(data.request_info.message || 'Rainforest search request failed');
  const results = (Array.isArray(data.search_results) ? data.search_results : [])
    .map(normalizeSearchResult)
    .filter(Boolean)
    .slice(0, Math.min(Math.max(Number(maxResults) || 10, 1), 25));

  return {
    searchTerm: query,
    totalResults: data.search_information?.total_results ?? results.length,
    results,
    sourceProvider: 'RAINFOREST',
    sourceVerified: true,
  };
}

module.exports = { searchRainforestStrict, normalizeSearchResult };
