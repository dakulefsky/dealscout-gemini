const express = require('express');
const router = express.Router();
const deals = require('../repositories/dealRepository');
const dealQueries = require('../repositories/dealQueryRepository');
const dealFeed = require('../repositories/dealFeedRepository');
const categories = require('../repositories/categoryRepository');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const { isPublicDeal } = require('../services/publicDealPolicy');
const { isAmazonUrl } = require('../services/amazonUrlService');
const { manualExpireChanges, manualRestoreChanges } = require('../services/manualDealLifecycle');

function rowToDeal(r, { includeInternal = false } = {}) {
  if (!r) return null;
  const now = Math.floor(Date.now() / 1000);
  const isExpired = r.is_expired === 1 || r.status === 'EXPIRED';
  const expiredAt = r.expired_at || null;
  const purgeInSeconds = isExpired && expiredAt ? Math.max(0, 86400 - (now - Number(expiredAt))) : null;
  const originalPrice = Number(r.original_price ?? 0);
  const salePrice = Number(r.sale_price ?? 0);
  const discountPercent = Number.isFinite(originalPrice) && Number.isFinite(salePrice) && originalPrice > 0 && salePrice > 0 && salePrice < originalPrice
    ? Number((((originalPrice - salePrice) / originalPrice) * 100).toFixed(1))
    : 0;
  const publicDeal = {
    id: r.id,
    title: r.title,
    asin: r.asin,
    category: r.category,
    originalPrice,
    salePrice,
    discountPercent,
    imageUrl: r.image_url,
    productUrl: r.product_url,
    qualityScore: Number(r.quality_score ?? 0),
    sourceVerified: r.source_verified === 1,
    status: r.status,
    isExpired,
    expiredAt,
    purgeInSeconds,
    purgeInHours: purgeInSeconds === null ? null : Number((purgeInSeconds / 3600).toFixed(1)),
    priceCheckAt: r.price_check_at || null,
    created_date: r.created_at ? new Date(Number(r.created_at) * 1000).toISOString() : null,
  };
  if (!includeInternal) return publicDeal;
  return {
    ...publicDeal,
    rating: Number(r.rating ?? 0),
    ratingsTotal: Number(r.ratings_total ?? 0),
    shortBio: r.short_bio,
    fullSummary: r.full_summary,
    pros: r.pros,
    cons: r.cons,
    reviews: Array.isArray(r.reviews) ? r.reviews : [],
    sourceSufficient: r.source_sufficient === 1,
    sourceProvider: r.source_provider || null,
    rawSourceData: r.raw_source_data || null,
    lastVerifyAttemptAt: r.last_verify_attempt_at || null,
  };
}

function canSeeDeal(req, deal) {
  return req.user?.role === 'admin' || isPublicDeal(deal);
}

function validatePrices(original, sale) {
  const o = Number(original);
  const s = Number(sale);
  if (!Number.isFinite(o) || !Number.isFinite(s) || o <= 0 || s <= 0 || s > o) throw new Error('Invalid price values');
  return { original: o, sale: s, discount: Number((((o - s) / o) * 100).toFixed(1)) };
}

function validateProductUrl(value, asin) {
  const url = String(value || `https://www.amazon.com/dp/${asin}`).trim();
  if (!isAmazonUrl(url)) throw new Error('Product URL must use an Amazon-owned host');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Product URL must use HTTPS');
  return parsed.toString();
}

function validStatus(status) {
  return ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'].includes(status);
}

router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const result = await dealQueries.stats({ isAdmin });
    if (!isAdmin) return res.json(result);
    const categoryRows = await categories.list();
    return res.json({ ...result, categoriesCount: categoryRows.length });
  } catch (err) {
    console.error('[deals] stats failed:', err.message);
    res.status(503).json({ error: 'Deal statistics are temporarily unavailable' });
  }
});

router.get('/feed', async (req, res) => {
  try {
    const result = await dealFeed.page(req.query);
    res.json({ items: result.items.map((deal) => rowToDeal(deal)), nextCursor: result.nextCursor });
  } catch (err) {
    if (err.message === 'Invalid cursor') return res.status(400).json({ error: 'Invalid feed cursor' });
    console.error('[deals] feed failed:', err.message);
    return res.status(503).json({ error: 'Deal feed is temporarily unavailable' });
  }
});

router.get('/', optionalAuth, async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const list = await dealQueries.list(req.query, { isAdmin });
    res.json(list.map((deal) => rowToDeal(deal, { includeInternal: isAdmin })));
  } catch (err) {
    console.error('[deals] list failed:', err.message);
    res.status(503).json({ error: 'Deals are temporarily unavailable' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const row = await deals.findByIdOrAsin(req.params.id);
    if (!row || !canSeeDeal(req, row)) return res.status(404).json({ error: 'Deal not found' });
    res.json(rowToDeal(row, { includeInternal: req.user?.role === 'admin' }));
  } catch (err) {
    console.error('[deals] lookup failed:', err.message);
    res.status(503).json({ error: 'Deals are temporarily unavailable' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const asin = String(b.asin || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error('Valid 10-character Amazon ASIN is required');
    if (!String(b.title || '').trim()) throw new Error('Title is required');
    const prices = validatePrices(b.originalPrice, b.salePrice);
    const sourceVerified = b.sourceVerified === true;
    const status = b.status || 'PENDING_REVIEW';
    if (!validStatus(status)) throw new Error('Invalid deal status');
    if (status === 'APPROVED' && !sourceVerified) throw new Error('Only source-verified deals can be approved');
    const existing = await deals.findByIdOrAsin(asin);
    const deal = await deals.upsert({
      id: asin,
      title: String(b.title).trim(), asin, category: String(b.category || 'Electronics').trim(),
      original_price: prices.original, sale_price: prices.sale, discount_percent: prices.discount,
      image_url: b.imageUrl || '', product_url: validateProductUrl(b.productUrl, asin),
      rating: Number(b.rating) || 0, ratings_total: Number(b.ratingsTotal) || 0,
      short_bio: b.shortBio || '', full_summary: b.fullSummary || '',
      pros: Array.isArray(b.pros) ? b.pros.join('\n') : (b.pros || ''),
      cons: Array.isArray(b.cons) ? b.cons.join('\n') : (b.cons || ''),
      reviews: b.reviews || [], source_sufficient: sourceVerified ? 1 : 0,
      source_verified: sourceVerified ? 1 : 0, source_provider: sourceVerified ? (b.sourceProvider || 'MANUAL_VERIFIED') : null,
      status, is_expired: 0, expired_at: null, price_check_at: Math.floor(Date.now() / 1000),
      raw_source_data: b.rawSourceData || '', created_at: existing?.created_at || Math.floor(Date.now() / 1000),
    });
    res.status(existing ? 200 : 201).json(rowToDeal(deal, { includeInternal: true }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const deal = await deals.findByIdOrAsin(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const b = req.body || {};
    const changes = {};
    if (b.asin !== undefined) {
      const asin = String(b.asin).trim().toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error('Invalid ASIN');
      changes.asin = asin;
    }
    if (b.title !== undefined) changes.title = String(b.title).trim();
    if (b.category !== undefined) changes.category = String(b.category).trim();
    if (b.originalPrice !== undefined || b.salePrice !== undefined) {
      const p = validatePrices(b.originalPrice ?? deal.original_price, b.salePrice ?? deal.sale_price);
      changes.original_price = p.original; changes.sale_price = p.sale; changes.discount_percent = p.discount;
    }
    if (b.imageUrl !== undefined) changes.image_url = b.imageUrl;
    if (b.productUrl !== undefined) changes.product_url = validateProductUrl(b.productUrl, changes.asin || deal.asin);
    else if (changes.asin) changes.product_url = validateProductUrl(null, changes.asin);
    if (b.rating !== undefined) changes.rating = Number(b.rating) || 0;
    if (b.ratingsTotal !== undefined) changes.ratings_total = Number(b.ratingsTotal) || 0;
    if (b.shortBio !== undefined) changes.short_bio = b.shortBio;
    if (b.fullSummary !== undefined) changes.full_summary = b.fullSummary;
    if (b.pros !== undefined) changes.pros = Array.isArray(b.pros) ? b.pros.join('\n') : b.pros;
    if (b.cons !== undefined) changes.cons = Array.isArray(b.cons) ? b.cons.join('\n') : b.cons;
    if (b.reviews !== undefined) changes.reviews = b.reviews;
    if (b.sourceVerified !== undefined) {
      changes.source_verified = b.sourceVerified ? 1 : 0;
      changes.source_sufficient = b.sourceVerified ? 1 : 0;
      if (!b.sourceVerified && deal.status === 'APPROVED') changes.status = 'PENDING_REVIEW';
    }
    if (b.sourceProvider !== undefined) changes.source_provider = b.sourceProvider;
    if (b.rawSourceData !== undefined) changes.raw_source_data = b.rawSourceData;
    if (b.status !== undefined) {
      if (!validStatus(b.status)) throw new Error('Invalid deal status');
      const effectiveVerified = changes.source_verified !== undefined ? changes.source_verified : deal.source_verified;
      if (b.status === 'APPROVED' && effectiveVerified !== 1) throw new Error('Only source-verified deals can be approved');
      changes.status = b.status;
    }
    res.json(rowToDeal(await deals.update(deal.id, changes), { includeInternal: true }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/approve-all', requireAdmin, async (_req, res) => {
  try { res.json({ success: true, approvedCount: await deals.approveAllVerified() }); }
  catch (err) { res.status(503).json({ error: err.message }); }
});

router.post('/bulk-status', requireAdmin, async (req, res) => {
  const { ids = [], status = 'APPROVED' } = req.body || {};
  if (!Array.isArray(ids) || !validStatus(status)) return res.status(400).json({ error: 'Invalid ids or status' });
  try { res.json({ success: true, updatedCount: await deals.bulkStatus(ids, status) }); }
  catch (err) { res.status(503).json({ error: err.message }); }
});

router.post('/:id/expire', requireAdmin, async (req, res) => {
  try {
    const current = await deals.findByIdOrAsin(req.params.id);
    if (!current) return res.status(404).json({ error: 'Deal not found' });
    const reason = req.body?.reason || 'Manually marked as expired by Admin';
    const updated = await deals.update(current.id, manualExpireChanges(current, reason));
    res.json({ success: true, deal: rowToDeal(updated, { includeInternal: true }) });
  } catch (err) { res.status(503).json({ error: err.message }); }
});

router.post('/:id/restore', requireAdmin, async (req, res) => {
  try {
    const current = await deals.findByIdOrAsin(req.params.id);
    if (!current) return res.status(404).json({ error: 'Deal not found' });
    if (current.source_verified !== 1) return res.status(409).json({ error: 'Unverified deals cannot be restored to approved status' });
    const updated = await deals.update(current.id, manualRestoreChanges());
    res.json({ success: true, deal: rowToDeal(updated, { includeInternal: true }) });
  } catch (err) { res.status(503).json({ error: err.message }); }
});

router.post('/purge-expired', requireAdmin, async (req, res) => {
  const hours = Number(req.body?.maxAgeHours ?? 24);
  if (!Number.isFinite(hours) || hours < 0) return res.status(400).json({ error: 'Invalid maxAgeHours' });
  try { res.json({ success: true, ...(await deals.purgeExpired(hours * 3600)) }); }
  catch (err) { res.status(503).json({ error: err.message }); }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try { res.json({ success: true, deleted: await deals.remove(req.params.id) }); }
  catch (err) { res.status(503).json({ error: err.message }); }
});

module.exports = router;