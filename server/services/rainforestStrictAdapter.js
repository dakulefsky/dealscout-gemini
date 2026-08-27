const axios = require('axios');

const ENDPOINT = 'https://api.rainforestapi.com/request';

function moneyValue(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && Number.isFinite(Number(value.value))) return Number(value.value);
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function affiliateUrl(asin) {
  const tag = process.env.AMAZON_ASSOCIATE_TAG;
  if (!tag) throw new Error('AMAZON_ASSOCIATE_TAG is required for Rainforest live products');
  return `https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(tag)}`;
}

function normalizeReviews(product) {
  if (!Array.isArray(product?.top_reviews)) return [];
  return product.top_reviews.slice(0, 8).map((review) => ({
    id: review.id || review.review_id || null,
    author: review.profile?.name || review.author?.name || review.author || 'Amazon Customer',
    title: review.title || '',
    text: review.body || review.text || '',
    rating: Number(review.rating) || null,
    date: review.date?.raw || review.date || '',
    verifiedPurchase: review.verified_purchase === true || review.is_verified === true || review.verified === true,
    helpfulVotes: Number(review.helpful_votes || review.helpful_count || 0),
    link: review.link || null,
  })).filter((review) => review.text);
}

async function fetchStrictRainforestProduct(asin, { amazonDomain = 'amazon.com', language = 'en_US' } = {}) {
  const apiKey = process.env.RAINFOREST_API_KEY;
  if (!apiKey) throw new Error('RAINFOREST_API_KEY is not configured');

  const response = await axios.get(ENDPOINT, {
    params: {
      api_key: apiKey,
      amazon_domain: amazonDomain,
      type: 'product',
      asin,
      language,
      include_html: false,
    },
    timeout: 20000,
    headers: { Accept: 'application/json', 'User-Agent': 'DealScout-Service/1.0' },
  });

  const data = response.data || {};
  if (data.request_info?.success === false) {
    throw new Error(data.request_info.message || 'Rainforest request failed');
  }

  const product = data.product;
  if (!product?.asin || !product?.title) throw new Error(`Rainforest returned no product for ${asin}`);

  const buybox = product.buybox_winner || {};
  const salePrice = moneyValue(buybox.price) ?? moneyValue(product.price);
  const originalPrice = moneyValue(buybox.rrp) ?? moneyValue(product.rrp);

  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error('Rainforest product has no verifiable current buy-box price');
  }
  if (!Number.isFinite(originalPrice) || originalPrice <= salePrice) {
    throw new Error('Rainforest product has no verifiable higher RRP/list price, so it is not treated as a deal');
  }

  const categories = Array.isArray(product.categories) ? product.categories : [];
  const category = categories[0]?.name || product.search_alias || 'Amazon';
  const imageUrl = product.main_image?.link || product.images?.[0]?.link || null;

  return {
    asin: String(product.asin).toUpperCase(),
    title: product.title,
    brand: product.brand || product.manufacturer || null,
    category,
    salePrice,
    originalPrice,
    discountPercent: Number((((originalPrice - salePrice) / originalPrice) * 100).toFixed(1)),
    savingsAmount: Number((originalPrice - salePrice).toFixed(2)),
    imageUrl,
    imageGallery: Array.isArray(product.images) ? product.images.map((image) => image.link).filter(Boolean) : [],
    productUrl: affiliateUrl(product.asin),
    rawProductUrl: product.link || `https://www.amazon.com/dp/${product.asin}`,
    rating: Number(product.rating) || null,
    ratingsTotal: Number(product.ratings_total) || 0,
    reviews: normalizeReviews(product),
    isPrime: buybox.is_prime === true,
    availability: buybox.availability?.raw || null,
    condition: buybox.condition?.is_new === true ? 'New' : null,
    dealBadge: product.deal_badge || product.product_deal?.deal_badge || null,
    recentSales: product.recent_sales || null,
    sourceProvider: 'RAINFOREST',
    sourceVerified: true,
    rawSourceData: `Rainforest API product lookup | ASIN: ${product.asin}`,
  };
}

module.exports = { fetchStrictRainforestProduct };
