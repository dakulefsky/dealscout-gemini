const { strictGetItems, strictSearchItems, getPaapiConfig } = require('./amazonPaapiStrictAdapter');
const { fetchStrictRainforestProduct } = require('./rainforestStrictAdapter');
const { fetchStrictRainforestDeals } = require('./rainforestStrictDiscovery');
const { runProviderCall, getProviderThrottleStatus } = require('./providerThrottle');
const { usageStatus } = require('./providerBudgetService');

const VALID_PROVIDERS = ['auto', 'amazon_paapi', 'rainforest'];
const PROVIDER_STOP_CODES = new Set(['PROVIDER_BUDGET_EXCEEDED', 'PROVIDER_COOLDOWN']);

function getConfiguredProvider() {
  const configured = String(process.env.DEAL_DATA_PROVIDER || 'auto').trim().toLowerCase();
  return VALID_PROVIDERS.includes(configured) ? configured : 'auto';
}

function isRainforestConfigured() {
  const key = String(process.env.RAINFOREST_API_KEY || '').trim();
  return Boolean(key && key !== 'your_rainforest_api_key_here');
}

function rethrowProviderStop(error) {
  if (PROVIDER_STOP_CODES.has(String(error?.code || ''))) throw error;
}

async function getProviderStatus() {
  const configuredProvider = getConfiguredProvider();
  const paapiConfig = getPaapiConfig();
  const rainforestConfigured = isRainforestConfigured();
  const rainforestBudget = await usageStatus('rainforest').catch((error) => ({ error: error.message }));
  let effectiveProvider = 'none';

  if (configuredProvider === 'amazon_paapi' && paapiConfig.isConfigured) effectiveProvider = 'amazon_paapi';
  else if (configuredProvider === 'rainforest' && rainforestConfigured) effectiveProvider = 'rainforest';
  else if (configuredProvider === 'auto') {
    if (paapiConfig.isConfigured) effectiveProvider = 'amazon_paapi';
    else if (rainforestConfigured) effectiveProvider = 'rainforest';
  }

  return {
    configuredProvider,
    effectiveProvider,
    paapi: {
      isConfigured: paapiConfig.isConfigured,
      maskedAccessKey: paapiConfig.maskedAccessKey,
      partnerTag: paapiConfig.partnerTag,
      region: paapiConfig.region,
      host: paapiConfig.host,
      status: paapiConfig.isConfigured ? 'Ready' : 'Not configured',
      throttle: getProviderThrottleStatus('amazon_paapi'),
    },
    rainforest: {
      isConfigured: rainforestConfigured,
      status: rainforestConfigured ? 'Ready' : 'Not configured',
      throttle: getProviderThrottleStatus('rainforest'),
      budget: rainforestBudget,
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

async function paapiProduct(cleanAsin, options) {
  return runProviderCall('amazon_paapi', async () => {
    const items = await strictGetItems([cleanAsin], { allowNonDeal: options.allowNonDeal === true });
    return normalizeVerifiedProduct(items?.[0], 'AMAZON_PAAPI');
  });
}

async function rainforestProduct(cleanAsin, options) {
  return runProviderCall('rainforest', async () => {
    const product = await fetchStrictRainforestProduct(cleanAsin, options);
    return normalizeVerifiedProduct(product, 'RAINFOREST');
  });
}

async function fetchProductByAsin(asin, options = {}) {
  const cleanAsin = String(asin || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(cleanAsin)) throw new Error('Invalid Amazon ASIN');

  const status = await getProviderStatus();
  const configuredProvider = status.configuredProvider;

  if (status.effectiveProvider === 'amazon_paapi') {
    try {
      const verified = await paapiProduct(cleanAsin, options);
      if (verified) return verified;
    } catch (err) {
      rethrowProviderStop(err);
      console.warn(`[ProviderRouter PA-API notice for ${cleanAsin}]:`, err.message);
      if (configuredProvider === 'amazon_paapi') return null;
    }
  }

  if (status.effectiveProvider === 'rainforest' || (configuredProvider === 'auto' && status.rainforest.isConfigured)) {
    try {
      const verified = await rainforestProduct(cleanAsin, options);
      if (verified) return verified;
      if (configuredProvider === 'rainforest') {
        console.warn(`[ProviderRouter Rainforest notice for ${cleanAsin}]: Rainforest returned product data but no verifiable original/sale price pair.`);
        return null;
      }
    } catch (err) {
      rethrowProviderStop(err);
      console.warn(`[ProviderRouter Rainforest notice for ${cleanAsin}]:`, err.message);
      if (configuredProvider === 'rainforest') return null;
    }
  }

  // Fail closed. Never fall back to legacy scraper, curated, or synthetic metadata.
  return null;
}

async function fetchDealsList(options = {}) {
  const status = await getProviderStatus();
  const configuredProvider = status.configuredProvider;

  if (status.effectiveProvider === 'amazon_paapi') {
    try {
      const result = await runProviderCall('amazon_paapi', () => strictSearchItems('deals of the day', { itemCount: options.maxResults || 15 }));
      const verified = (result?.results || []).map((item) => normalizeVerifiedProduct(item, 'AMAZON_PAAPI')).filter(Boolean);
      if (verified.length) return verified;
      if (configuredProvider === 'amazon_paapi') return [];
    } catch (err) {
      rethrowProviderStop(err);
      console.warn('[ProviderRouter PA-API search notice]:', err.message);
      if (configuredProvider === 'amazon_paapi') return [];
    }
  }

  if (status.effectiveProvider === 'rainforest' || (configuredProvider === 'auto' && status.rainforest.isConfigured)) {
    try {
      const result = await runProviderCall('rainforest', () => fetchStrictRainforestDeals(options));
      const verified = (result || []).map((item) => normalizeVerifiedProduct(item, 'RAINFOREST')).filter(Boolean);
      if (verified.length) return verified;
      if (configuredProvider === 'rainforest') return [];
    } catch (err) {
      rethrowProviderStop(err);
      console.warn('[ProviderRouter Rainforest deals notice]:', err.message);
      if (configuredProvider === 'rainforest') return [];
    }
  }

  // Fail closed. Never fall back to legacy scraper, curated, or synthetic metadata.
  return [];
}

module.exports = { getConfiguredProvider, getProviderStatus, fetchProductByAsin, fetchDealsList, rethrowProviderStop };
