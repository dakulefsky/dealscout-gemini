const { strictGetItems, strictSearchItems, getPaapiConfig } = require('./amazonPaapiStrictAdapter');
const { fetchStrictRainforestProduct } = require('./rainforestStrictAdapter');
const { fetchStrictRainforestDeals } = require('./rainforestStrictDiscovery');

const VALID_PROVIDERS = ['auto', 'amazon_paapi', 'rainforest'];
let activeProvider = VALID_PROVIDERS.includes(process.env.DEAL_DATA_PROVIDER)
  ? process.env.DEAL_DATA_PROVIDER
  : 'auto';

function getActiveProvider() { return activeProvider; }

function isRainforestConfigured() {
  const key = String(process.env.RAINFOREST_API_KEY || '').trim();
  return Boolean(key && key !== 'your_rainforest_api_key_here');
}

function setActiveProvider(provider) {
  if (!VALID_PROVIDERS.includes(provider)) throw new Error(`Invalid provider '${provider}'. Allowed: ${VALID_PROVIDERS.join(', ')}`);
  activeProvider = provider;
  return activeProvider;
}

async function getProviderStatus() {
  const paapiConfig = getPaapiConfig();
  const rainforestConfigured = isRainforestConfigured();
  let effectiveProvider = 'none';

  if (activeProvider === 'amazon_paapi' && paapiConfig.isConfigured) effectiveProvider = 'amazon_paapi';
  else if (activeProvider === 'rainforest' && rainforestConfigured) effectiveProvider = 'rainforest';
  else if (activeProvider === 'auto') {
    if (paapiConfig.isConfigured) effectiveProvider = 'amazon_paapi';
    else if (rainforestConfigured) effectiveProvider = 'rainforest';
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
      status: rainforestConfigured ? 'Ready' : 'Not configured',
    },
  };
}

function normalizeVerifiedProduct(product, provider) {
  if (!product || !product.asin || !product.title) return null;
  const originalPrice = Number(product.originalPrice ?? product.original_price);
  const salePrice = Number(product.salePrice ?? product.sale_price);
  if (!Number.isFinite(originalPrice) || !Number.isFinite(salePrice) || originalPrice <= 0 || salePrice <= 0 || salePrice > originalPrice) return null;
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
      const items = await strictGetItems([cleanAsin], { allowNonDeal: options.allowNonDeal === true });
      const verified = normalizeVerifiedProduct(items?.[0], 'AMAZON_PAAPI');
      if (verified) return verified;
    } catch (err) {
      console.warn(`[ProviderRouter PA-API notice for ${cleanAsin}]:`, err.message);
      if (activeProvider === 'amazon_paapi') return null;
    }
  }

  if (status.effectiveProvider === 'rainforest' || (activeProvider === 'auto' && status.rainforest.isConfigured)) {
    try {
      const product = await fetchStrictRainforestProduct(cleanAsin, options);
      const verified = normalizeVerifiedProduct(product, 'RAINFOREST');
      if (verified) return verified;
      if (activeProvider === 'rainforest') {
        console.warn(`[ProviderRouter Rainforest notice for ${cleanAsin}]: Rainforest returned product data but no verifiable original/sale price pair.`);
        return null;
      }
    } catch (err) {
      console.warn(`[ProviderRouter Rainforest notice for ${cleanAsin}]:`, err.message);
      if (activeProvider === 'rainforest') return null;
    }
  }

  // Fail closed. Never fall back to legacy scraper, curated, or synthetic metadata.
  return null;
}

async function fetchDealsList(options = {}) {
  const status = await getProviderStatus();
  if (status.effectiveProvider === 'amazon_paapi') {
    try {
      const result = await strictSearchItems('deals of the day', { itemCount: options.maxResults || 15 });
      const verified = (result?.results || []).map((x) => normalizeVerifiedProduct(x, 'AMAZON_PAAPI')).filter(Boolean);
      if (verified.length) return verified;
      if (activeProvider === 'amazon_paapi') return [];
    } catch (err) {
      console.warn('[ProviderRouter PA-API search notice]:', err.message);
      if (activeProvider === 'amazon_paapi') return [];
    }
  }
  if (status.effectiveProvider === 'rainforest' || (activeProvider === 'auto' && status.rainforest.isConfigured)) {
    try {
      const result = await fetchStrictRainforestDeals(options);
      const verified = (result || []).map((x) => normalizeVerifiedProduct(x, 'RAINFOREST')).filter(Boolean);
      if (verified.length) return verified;
      if (activeProvider === 'rainforest') return [];
    } catch (err) {
      console.warn('[ProviderRouter Rainforest deals notice]:', err.message);
      if (activeProvider === 'rainforest') return [];
    }
  }
  return [];
}

module.exports = { getActiveProvider, setActiveProvider, getProviderStatus, fetchProductByAsin, fetchDealsList };