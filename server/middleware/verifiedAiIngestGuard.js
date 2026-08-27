const { fetchProductByAsin } = require('../services/providerRouter');

function isAiIngest(body = {}) {
  return /^Gemini AI Ingest\b/i.test(String(body.rawSourceData || body.raw_source_data || '').trim());
}

function normalizeVerifiedAiBody(body = {}, live = {}) {
  if (!live?.sourceVerified) throw new Error('AI-assisted deal must be verified by a live product source before saving');

  const asin = String(live.asin || body.asin || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error('Verified provider did not return a valid ASIN');

  const originalPrice = Number(live.originalPrice);
  const salePrice = Number(live.salePrice);
  if (!Number.isFinite(originalPrice) || !Number.isFinite(salePrice) || originalPrice <= 0 || salePrice <= 0 || salePrice > originalPrice) {
    throw new Error('Verified provider did not return a valid original/sale price pair');
  }

  return {
    ...body,
    asin,
    title: String(live.title || '').trim(),
    originalPrice,
    salePrice,
    imageUrl: live.imageUrl || '',
    productUrl: live.productUrl || `https://www.amazon.com/dp/${asin}`,
    rating: Number(live.rating) || 0,
    ratingsTotal: Number(live.ratingsTotal) || 0,
    reviews: [],
    sourceVerified: true,
    sourceProvider: live.sourceProvider || 'VERIFIED_PROVIDER',
    rawSourceData: `${live.sourceProvider || 'Verified provider'} | AI-assisted editorial content | ASIN: ${asin}`,
  };
}

async function verifiedAiIngestGuard(req, res, next) {
  if (req.method !== 'POST' || !isAiIngest(req.body)) return next();

  try {
    const asin = String(req.body?.asin || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) {
      return res.status(422).json({ error: 'AI-assisted deal save requires a real 10-character ASIN verified by the active provider.' });
    }

    const live = await fetchProductByAsin(asin, { customUrl: req.body?.productUrl });
    req.body = normalizeVerifiedAiBody(req.body, live);
    next();
  } catch (err) {
    console.warn('[verifiedAiIngestGuard] blocked AI deal save:', err.message);
    return res.status(422).json({ error: err.message });
  }
}

module.exports = { verifiedAiIngestGuard, normalizeVerifiedAiBody, isAiIngest };
