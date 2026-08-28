const express = require('express');
const router = express.Router();
const deals = require('../repositories/dealRepository');
const { requireAdmin } = require('../middleware/auth');
const {
  extractAsin,
  formatAffiliateUrl,
} = require('../services/rainforestService');
const {
  isPaapiConfigured,
  getPaapiConfig,
  getItems: getPaapiItems,
} = require('../services/amazonPaapiService');
const {
  parseSiteStripeInput,
  resolveShortlink,
  robustExtractAsin,
} = require('../services/siteStripeService');
const {
  setActiveProvider,
  getProviderStatus,
  fetchProductByAsin,
  fetchDealsList,
} = require('../services/providerRouter');
const dealCron = require('../services/cronService');

const AMAZON_ASSOCIATE_TAG = String(process.env.AMAZON_ASSOCIATE_TAG || '').trim();

function calculatedDiscount(originalPrice, salePrice) {
  const original = Number(originalPrice);
  const sale = Number(salePrice);
  if (!Number.isFinite(original) || !Number.isFinite(sale) || original <= 0 || sale <= 0 || sale > original) return null;
  return Number((((original - sale) / original) * 100).toFixed(1));
}

function requireVerifiedProduct(item) {
  const discount = calculatedDiscount(item?.originalPrice ?? item?.original_price, item?.salePrice ?? item?.sale_price);
  if (!item || item.sourceVerified !== true || !item.asin || !item.title || discount === null) return null;
  return {
    ...item,
    originalPrice: Number(item.originalPrice ?? item.original_price),
    salePrice: Number(item.salePrice ?? item.sale_price),
    discountPercent: discount,
  };
}

function providerDealRecord(item, status = 'PENDING_REVIEW', productUrl) {
  return {
    id: item.asin,
    title: item.title,
    asin: item.asin,
    category: item.category || 'Electronics',
    original_price: item.originalPrice,
    sale_price: item.salePrice,
    discount_percent: item.discountPercent,
    image_url: item.imageUrl || item.image_url || '',
    product_url: formatAffiliateUrl(productUrl || item.productUrl || item.product_url || `https://www.amazon.com/dp/${item.asin}`, AMAZON_ASSOCIATE_TAG),
    rating: 0,
    ratings_total: 0,
    short_bio: '',
    full_summary: '',
    pros: '',
    cons: '',
    reviews: [],
    source_sufficient: 1,
    source_verified: 1,
    source_provider: item.sourceProvider || 'VERIFIED_PROVIDER',
    status,
    is_expired: 0,
    expired_at: null,
    price_check_at: Math.floor(Date.now() / 1000),
    raw_source_data: item.rawSourceData || item.raw_source_data || `${item.sourceProvider || 'Verified provider'} | ASIN: ${item.asin}`,
    created_at: Math.floor(Date.now() / 1000),
  };
}

router.get('/provider-status', async (_req, res) => {
  try {
    res.json({
      ...(await getProviderStatus()),
      lifecycle: await deals.lifecycleStats(),
      cron: await dealCron.getStatus(),
      associateTag: AMAZON_ASSOCIATE_TAG,
    });
  } catch (err) {
    res.status(503).json({ error: 'Provider status is temporarily unavailable', details: err.message });
  }
});

async function switchProvider(req, res) {
  try {
    const updated = setActiveProvider(req.body?.provider);
    res.json({ success: true, activeProvider: updated, status: await getProviderStatus() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
router.post('/set-provider', requireAdmin, switchProvider);
router.post('/provider-switch', requireAdmin, switchProvider);

router.post('/test-paapi', requireAdmin, async (req, res) => {
  const cleanAsin = extractAsin(req.body?.asin || 'B08PZHYWJS') || 'B08PZHYWJS';
  if (!isPaapiConfigured()) {
    return res.status(400).json({ success: false, isConfigured: false, error: 'Amazon PA-API credentials are not configured.', config: getPaapiConfig() });
  }
  try {
    const items = await getPaapiItems([cleanAsin]);
    res.json({ success: true, asin: cleanAsin, item: items?.[0] || null });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code || 'PAAPI_TEST_FAILED' });
  }
});

router.post('/parse-sitestripe', async (req, res) => {
  const rawInput = String(req.body?.input || req.body?.inputUrl || req.body?.url || '').trim();
  if (!rawInput) return res.status(400).json({ error: 'Please provide a SiteStripe link, shortlink, or ASIN.' });
  try {
    const parsed = parseSiteStripeInput(rawInput);
    if ((parsed.isShortlink || !parsed.asin) && /^https?:/i.test(rawInput)) {
      const resolved = await resolveShortlink(parsed.shortlinkUrl || rawInput);
      if (resolved.asin) {
        parsed.asin = resolved.asin;
        parsed.cleanUrl = formatAffiliateUrl(resolved.finalUrl || `https://www.amazon.com/dp/${resolved.asin}`, AMAZON_ASSOCIATE_TAG);
        parsed.valid = true;
      }
    }
    res.json(parsed);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to parse Amazon link.' });
  }
});

async function handleSiteStripeImportReq(req, res) {
  try {
    const rawInput = String(req.body?.input || req.body?.inputUrl || req.body?.url || req.body?.asin || req.body?.text || '').trim();
    if (!rawInput) return res.status(400).json({ error: 'Input URL, SiteStripe link, or ASIN is required.' });

    const parsed = parseSiteStripeInput(rawInput);
    let asin = parsed.asin || robustExtractAsin(rawInput);
    let customUrl = parsed.cleanUrl || parsed.shortlinkUrl || (/^https?:/i.test(rawInput) ? rawInput : null);
    if ((!asin || parsed.isShortlink) && /^https?:/i.test(rawInput)) {
      const resolved = await resolveShortlink(parsed.shortlinkUrl || rawInput);
      asin = resolved.asin || asin;
      customUrl = resolved.finalUrl || customUrl;
    }
    if (!asin) return res.status(400).json({ error: 'Could not extract a valid Amazon ASIN.' });

    const existing = await deals.findByIdOrAsin(asin);
    if (existing) return res.json({ success: true, alreadyExists: true, deal: existing, affiliateTag: AMAZON_ASSOCIATE_TAG });

    const item = requireVerifiedProduct(await fetchProductByAsin(asin, { customUrl }));
    if (!item) {
      return res.status(422).json({ error: 'Deal could not be verified from a live source. It was not imported.', code: 'UNVERIFIED_DEAL' });
    }

    const deal = await deals.upsert(providerDealRecord(item, req.body?.autoApprove === true ? 'APPROVED' : 'PENDING_REVIEW', customUrl));
    res.json({ success: true, alreadyExists: false, deal, affiliateTag: AMAZON_ASSOCIATE_TAG });
  } catch (err) {
    console.error('[SiteStripe Import Error]', err);
    res.status(500).json({ error: err.message || 'Failed to import SiteStripe deal.' });
  }
}
router.post('/import-sitestripe', requireAdmin, handleSiteStripeImportReq);
router.post('/sitestripe-import', requireAdmin, handleSiteStripeImportReq);

router.post('/verify-prices', requireAdmin, async (_req, res) => {
  try {
    const result = await dealCron.checkDealPricesAndAvailability();
    res.json({ success: true, ...result, lifecycle: await deals.lifecycleStats() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/purge-expired', requireAdmin, async (req, res) => {
  try {
    const maxAgeHours = Math.max(1, Number(req.body?.maxAgeHours) || 24);
    const result = await deals.purgeExpired(maxAgeHours * 3600);
    res.json({ success: true, ...result, lifecycle: await deals.lifecycleStats() });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

router.post('/amazon-redirect', (req, res) => {
  const url = req.body?.url;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing or invalid url' });
  try { res.json({ redirectUrl: formatAffiliateUrl(url, AMAZON_ASSOCIATE_TAG), tag: AMAZON_ASSOCIATE_TAG }); }
  catch (err) { res.status(400).json({ error: err.message || 'Invalid Amazon URL' }); }
});

router.post('/rainforest-lookup', requireAdmin, async (req, res) => {
  try {
    const rawInput = String(req.body?.input || '').trim();
    if (!rawInput) return res.status(400).json({ error: 'Product ASIN or Amazon URL is required.' });
    let asin = extractAsin(rawInput);
    let customUrl = /^https?:/i.test(rawInput) ? rawInput : null;
    if (!asin && customUrl) {
      const resolved = await resolveShortlink(rawInput);
      asin = resolved.asin;
      customUrl = resolved.finalUrl || customUrl;
    }
    if (!asin) return res.status(400).json({ error: 'Could not detect a valid Amazon ASIN.' });
    const data = await fetchProductByAsin(asin, { amazonDomain: req.body?.amazonDomain, customUrl });
    if (!data) return res.status(404).json({ error: 'No verifiable product data was found.' });
    res.json({ configured: true, asin, data });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lookup failed' });
  }
});

router.post('/fetch-deals', requireAdmin, async (req, res) => {
  try {
    const maxResults = Math.min(50, Math.max(1, Number(req.body?.maxDeals) || 15));
    const dealsToIngest = await fetchDealsList({ maxResults });
    let created = 0;
    const skipped = [];

    for (const rawItem of dealsToIngest) {
      const item = requireVerifiedProduct(rawItem);
      if (!item) {
        skipped.push({ asin: rawItem?.asin || null, reason: 'unverified' });
        continue;
      }
      if (await deals.findByIdOrAsin(item.asin)) {
        skipped.push({ asin: item.asin, reason: 'exists' });
        continue;
      }
      await deals.upsert(providerDealRecord(item));
      created += 1;
    }
    res.json({ created, skipped, processed: dealsToIngest.length });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch deals' });
  }
});

module.exports = router;