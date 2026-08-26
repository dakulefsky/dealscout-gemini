const { getItems, searchItems, getPaapiConfig } = require('./amazonPaapiService');
const {
  isConfigured: isRainforestConfigured,
  isQuotaExhausted,
  fetchProductByAsin: fetchRainforestProduct,
  fetchRainforestDeals,
  SAMPLE_DEAL_POOL,
} = require('./rainforestService');
const { resolveProductDetails } = require('./amazonScraperService');

let activeProvider = process.env.DEAL_DATA_PROVIDER || 'auto';

function getActiveProvider() { return activeProvider; }

function setActiveProvider(provider) {
  const valid = ['auto', 'amazon_paapi', 'rainforest', 'curated'];
  if (!valid.includes(provider)) throw new Error(`Invalid provider '${provider}'. Allowed: ${valid.join(', ')}`);
  activeProvider = provider;
  return activeProvider;
}

async function getProviderStatus() {
  const paapiConfig = getPaapiConfig();
  const rainforestConfigured = isRainforestConfigured();
  const rainforestQuotaExhausted = isQuotaExhausted();
  let effectiveProvider = 'none';

  if (activeProvider === 'amazon_paapi' && paapiConfig.isConfigured) effectiveProvider = 'amazon_paapi';
  else if (activeProvider === 'rainforest' && rainforestConfigured && !rainforestQuotaExhausted) effectiveProvider = 'rainforest';
  else if (activeProvider === 'curated') effectiveProvider = 'curated';
  else if (activeProvider === 'auto') {
    if (paapiConfig.isConfigured) effectiveProvider = 'amazon_paapi';
    else if (rainforestConfigured && !rainforestQuotaExhausted) effectiveProvider = 'rainforest';
    else effectiveProvider = 'none';
  }

  return {
    configuredProvider: activeProvider,
    effectiveProvider,
    paapi: {
      isConfigured: paapiConfig.isConfigured,
      maskedAccessKey: paapiConfig.maskedAccessKey,
      partnerTag: paapiConfig.partnerTag,
      region: paapiConfig.region,
      host: paapiConfig.host,
      status: paapiConfig.isConfigured ? 'Ready' : 'Not configured',
    },
    rainforest: {
      isConfigured: rainforestConfigured,
      isQuotaExhausted: rainforestQuotaExhausted,
      status: rainforestQuotaExhausted ? 'Quota exhausted' : rainforestConfigured ? 'Ready' : 'Not configured',
    },
    curated: {
      isReady: true,
      poolSize: SAMPLE_DEAL_POOL.length,
      status: 'Development/demo data only',
    },
  };
}

function normalizeVerifiedProduct(product, provider) {
  if (!product || !product.asin || !product.title) return null;
  const originalPrice = Number(product.originalPrice ?? product.original_price);
  const salePrice = Number(product.salePrice ?? product.sale_price);
  if (!Number.isFinite(originalPrice) || !Number.isFinite(salePrice) || originalPrice <= 0 || salePrice < 0 || salePrice > originalPrice) return null;
  const discountPercent = Number((((originalPrice - salePrice) / originalPrice) * 100).toFixed(1));
  return {
    ...product,
    asin: String(product.asin).trim().toUpperCase(),
    originalPrice,
    salePrice,
    discountPercent,
    savingsAmount: Number((originalPrice - salePrice).toFixed(2)),
    sourceProvider: provider,
    sourceVerified: true,
  };
}

async function fetchProductByAsin(asin, options = {}) {
  const cleanAsin = (asin || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(cleanAsin)) throw new Error('Invalid Amazon ASIN');
  const status = await getProviderStatus();

  if (status.effectiveProvider === 'amazon_paapi') {
    try {
      const items = await getItems([cleanAsin]);
      const verified = normalizeVerifiedProduct(items?.[0], 'AMAZON_PAAPI');
      if (verified) return verified;
    } catch (err) {
      console.warn(`[ProviderRouter PA-API notice for ${cleanAsin}]:`, err.message);
    }
  }

  if (status.effectiveProvider === 'rainforest' || (activeProvider === 'auto' && status.rainforest.isConfigured && !status.rainforest.isQuotaExhausted)) {
    try {
      const product = await fetchRainforestProduct(cleanAsin, options);
      const verified = normalizeVerifiedProduct(product, 'RAINFOREST');
      if (verified) return verified;
    } catch (err) {
      console.warn(`[ProviderRouter Rainforest notice for ${cleanAsin}]:`, err.message);
    }
  }

  if (activeProvider === 'curated') {
    const sample = SAMPLE_DEAL_POOL.find((d) => d.asin === cleanAsin);
    if (sample) return normalizeVerifiedProduct({ ...sample, originalPrice: sample.original_price, salePrice: sample.sale_price }, 'CURATED_DEMO');
    return null;
  }

  // Scraping/AI may enrich a product, but it is never allowed to manufacture a deal.
  try {
    const resolved = await resolveProductDetails(cleanAsin, options.customUrl || options.url);
    if (resolved?.sourceVerified && resolved.title) {
      return normalizeVerifiedProduct(resolved, resolved.sourceProvider || 'LIVE_VERIFIED');
    }
  } catch (err) {
    console.warn(`[ProviderRouter live resolution notice for ${cleanAsin}]:`, err.message);
  }

  return null;
}

async function fetchDealsList(options = {}) {
  const status = await getProviderStatus();
  if (status.effectiveProvider === 'amazon_paapi') {
    try {
      const result = await searchItems('deals of the day', { itemCount: options.maxResults || 15 });
      const verified = (result?.results || []).map((x) => normalizeVerifiedProduct(x, 'AMAZON_PAAPI')).filter(Boolean);
      if (verified.length) return verified;
    } catch (err) { console.warn('[ProviderRouter PA-API search notice]:', err.message); }
  }
  if (status.effectiveProvider === 'rainforest' || (activeProvider === 'auto' && status.rainforest.isConfigured && !status.rainforest.isQuotaExhausted)) {
    try {
      const result = await fetchRainforestDeals(options);
      const verified = (result || []).map((x) => normalizeVerifiedProduct(x, 'RAINFOREST')).filter(Boolean);
      if (verified.length) return verified;
    } catch (err) { console.warn('[ProviderRouter Rainforest deals notice]:', err.message); }
  }
  if (activeProvider === 'curated') return getCuratedSampleDeals(options.maxResults || 15, options.minDiscount || 10);
  return [];
}

module.exports = { getActiveProvider, setActiveProvider, getProviderStatus, fetchProductByAsin, fetchDealsList };