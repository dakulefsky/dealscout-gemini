const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const { isConfigured, isQuotaExhausted, fetchProductReviews } = require('../services/rainforestService');

function rowToDeal(r) {
  if (!r) return null;
  let reviews = [];
  try { reviews = typeof r.reviews === 'string' ? JSON.parse(r.reviews) : (r.reviews || []); } catch {}
  const now = Math.floor(Date.now() / 1000);
  const isExpired = r.is_expired === 1 || r.status === 'EXPIRED';
  const expiredAt = r.expired_at || null;
  const purgeInSeconds = isExpired && expiredAt ? Math.max(0, 86400 - (now - expiredAt)) : null;
  return {
    id: r.id,
    title: r.title,
    asin: r.asin,
    category: r.category,
    originalPrice: Number(r.original_price ?? 0),
    salePrice: Number(r.sale_price ?? 0),
    discountPercent: Number(r.discount_percent ?? 0),
    imageUrl: r.image_url,
    productUrl: r.product_url,
    rating: Number(r.rating ?? 0),
    ratingsTotal: Number(r.ratings_total ?? 0),
    shortBio: r.short_bio,
    fullSummary: r.full_summary,
    pros: r.pros,
    cons: r.cons,
    reviews,
    sourceSufficient: r.source_sufficient === 1,
    sourceVerified: r.source_verified === 1,
    sourceProvider: r.source_provider || null,
    status: r.status,
    isExpired,
    expiredAt,
    purgeInSeconds,
    purgeInHours: purgeInSeconds === null ? null : Number((purgeInSeconds / 3600).toFixed(1)),
    priceCheckAt: r.price_check_at || null,
    rawSourceData: r.raw_source_data || null,
    created_date: r.created_at ? new Date(r.created_at * 1000).toISOString() : null,
  };
}

function canSeeDeal(req, deal) {
  return req.user?.role === 'admin' || (deal.status === 'APPROVED' && deal.is_expired !== 1 && deal.source_verified === 1);
}

function validatePrices(original, sale) {
  const o = Number(original);
  const s = Number(sale);
  if (!Number.isFinite(o) || !Number.isFinite(s) || o <= 0 || s <= 0 || s > o) throw new Error('Invalid price values');
  return { original: o, sale: s, discount: Number((((o - s) / o) * 100).toFixed(1)) };
}

function validStatus(status) {
  return ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'].includes(status);
}

router.get('/stats', optionalAuth, (req, res) => {
  const all = db.tables.deals || [];
  if (req.user?.role !== 'admin') {
    const approved = all.filter((d) => canSeeDeal(req, d));
    return res.json({
      total: approved.length,
      approvedCount: approved.length,
      avgDiscount: approved.length ? Math.round(approved.reduce((sum, d) => sum + Number(d.discount_percent || 0), 0) / approved.length) : 0,
      categoriesCount: new Set(approved.map((d) => d.category).filter(Boolean)).size,
    });
  }

  const approved = all.filter((d) => d.status === 'APPROVED' && !d.is_expired);
  const pending = all.filter((d) => d.status === 'PENDING_REVIEW');
  const expired = all.filter((d) => d.is_expired === 1 || d.status === 'EXPIRED');
  const rejected = all.filter((d) => d.status === 'REJECTED');
  const lifecycle = db.getDealLifecycleStats();
  res.json({
    total: all.length,
    approvedCount: approved.length,
    pendingCount: pending.length,
    expiredCount: expired.length,
    rejectedCount: rejected.length,
    readyToPurgeCount: lifecycle.readyToPurgeCount,
    avgDiscount: approved.length ? Math.round(approved.reduce((sum, d) => sum + Number(d.discount_percent || 0), 0) / approved.length) : 0,
    categoriesCount: (db.tables.categories || []).length,
    bookmarksCount: (db.tables.bookmarks || []).length,
    lifecycle,
  });
});

router.get('/:id/price-history', optionalAuth, (req, res) => {
  const deal = db.tables.deals.find((d) => d.id === req.params.id || d.asin === req.params.id);
  if (!deal || !canSeeDeal(req, deal)) return res.status(404).json({ error: 'Deal not found' });
  res.json({ history: db.getDealPriceHistory(deal), deal: rowToDeal(deal) });
});

router.get('/', optionalAuth, (req, res) => {
  const { status, category, q, minDiscount, maxPrice, minPrice, minRating, sort = '-created_date', limit = 100 } = req.query;
  const isAdmin = req.user?.role === 'admin';
  let list = [...(db.tables.deals || [])];

  if (isAdmin) {
    if (status) list = list.filter((d) => d.status === status);
  } else {
    list = list.filter((d) => canSeeDeal(req, d));
  }

  if (category && category !== 'All' && category !== 'All Deals') {
    list = list.filter((d) => String(d.category || '').toLowerCase() === String(category).toLowerCase());
  }
  if (q && typeof q === 'string' && q.trim()) {
    const term = q.trim().toLowerCase();
    list = list.filter((d) => [d.title, d.short_bio, d.full_summary, d.asin, d.category].some((v) => String(v || '').toLowerCase().includes(term)));
  }

  const n = (v) => Number(v);
  if (minDiscount !== undefined && Number.isFinite(n(minDiscount))) list = list.filter((d) => n(d.discount_percent) >= n(minDiscount));
  if (minPrice !== undefined && Number.isFinite(n(minPrice))) list = list.filter((d) => n(d.sale_price) >= n(minPrice));
  if (maxPrice !== undefined && Number.isFinite(n(maxPrice))) list = list.filter((d) => n(d.sale_price) <= n(maxPrice));
  if (minRating !== undefined && Number.isFinite(n(minRating))) list = list.filter((d) => n(d.rating) >= n(minRating));

  if (sort === 'discount_desc' || sort === '-discount_percent') list.sort((a, b) => n(b.discount_percent) - n(a.discount_percent));
  else if (sort === 'price_asc') list.sort((a, b) => n(a.sale_price) - n(b.sale_price));
  else if (sort === 'price_desc') list.sort((a, b) => n(b.sale_price) - n(a.sale_price));
  else if (sort === 'rating_desc') list.sort((a, b) => n(b.rating) - n(a.rating));
  else list.sort((a, b) => n(b.created_at) - n(a.created_at));

  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 100);
  res.json(list.slice(0, safeLimit).map(rowToDeal));
});

router.get('/:id', optionalAuth, (req, res) => {
  const row = db.tables.deals.find((x) => x.id === req.params.id || x.asin === req.params.id);
  if (!row || !canSeeDeal(req, row)) return res.status(404).json({ error: 'Deal not found' });
  res.json(rowToDeal(row));
});

router.post('/:id/sync-reviews', requireAdmin, async (req, res) => {
  const row = db.tables.deals.find((x) => x.id === req.params.id || x.asin === req.params.id);
  if (!row) return res.status(404).json({ error: 'Deal not found' });
  if (row.source_verified !== 1) return res.status(409).json({ error: 'Deal is not source-verified' });
  if (!isConfigured() || isQuotaExhausted()) return res.status(503).json({ error: 'Verified review source is unavailable' });
  try {
    const reviews = await fetchProductReviews(row.asin, { sortBy: 'most_helpful' });
    if (!Array.isArray(reviews)) return res.status(502).json({ error: 'Verified review source returned invalid data' });
    row.reviews = JSON.stringify(reviews);
    db.saveDb();
    res.json({ success: true, dealId: row.id, asin: row.asin, reviews, count: reviews.length, deal: rowToDeal(row) });
  } catch (err) {
    console.warn(`[deals] review synchronization failed for ${row.asin}:`, err.message);
    res.status(502).json({ error: 'Unable to synchronize verified reviews' });
  }
});

router.post('/', requireAdmin, (req, res) => {
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

    const deal = {
      id: asin,
      title: String(b.title).trim(),
      asin,
      category: String(b.category || 'Electronics').trim(),
      original_price: prices.original,
      sale_price: prices.sale,
      discount_percent: prices.discount,
      image_url: b.imageUrl || '',
      product_url: b.productUrl || `https://www.amazon.com/dp/${asin}`,
      rating: Number(b.rating) || 0,
      ratings_total: Number(b.ratingsTotal) || 0,
      short_bio: b.shortBio || '',
      full_summary: b.fullSummary || '',
      pros: Array.isArray(b.pros) ? b.pros.join('\n') : (b.pros || ''),
      cons: Array.isArray(b.cons) ? b.cons.join('\n') : (b.cons || ''),
      reviews: typeof b.reviews === 'string' ? b.reviews : JSON.stringify(b.reviews || []),
      source_sufficient: sourceVerified ? 1 : 0,
      source_verified: sourceVerified ? 1 : 0,
      source_provider: sourceVerified ? (b.sourceProvider || 'MANUAL_VERIFIED') : null,
      status,
      raw_source_data: b.rawSourceData || '',
      created_at: Math.floor(Date.now() / 1000),
    };

    const index = db.tables.deals.findIndex((x) => x.id === asin || x.asin === asin);
    if (index >= 0) db.tables.deals[index] = { ...db.tables.deals[index], ...deal };
    else db.tables.deals.unshift(deal);
    db.saveDb();
    res.status(index >= 0 ? 200 : 201).json(rowToDeal(deal));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireAdmin, (req, res) => {
  const deal = db.tables.deals.find((x) => x.id === req.params.id || x.asin === req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  const b = req.body || {};

  try {
    if (b.asin !== undefined) {
      const asin = String(b.asin).trim().toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error('Invalid ASIN');
      deal.asin = asin;
    }
    if (b.title !== undefined) deal.title = String(b.title).trim();
    if (b.category !== undefined) deal.category = String(b.category).trim();
    if (b.originalPrice !== undefined || b.salePrice !== undefined) {
      const p = validatePrices(b.originalPrice ?? deal.original_price, b.salePrice ?? deal.sale_price);
      deal.original_price = p.original;
      deal.sale_price = p.sale;
      deal.discount_percent = p.discount;
    }
    if (b.imageUrl !== undefined) deal.image_url = b.imageUrl;
    if (b.productUrl !== undefined) deal.product_url = b.productUrl;
    if (b.rating !== undefined) deal.rating = Number(b.rating) || 0;
    if (b.ratingsTotal !== undefined) deal.ratings_total = Number(b.ratingsTotal) || 0;
    if (b.shortBio !== undefined) deal.short_bio = b.shortBio;
    if (b.fullSummary !== undefined) deal.full_summary = b.fullSummary;
    if (b.pros !== undefined) deal.pros = Array.isArray(b.pros) ? b.pros.join('\n') : b.pros;
    if (b.cons !== undefined) deal.cons = Array.isArray(b.cons) ? b.cons.join('\n') : b.cons;
    if (b.reviews !== undefined) deal.reviews = typeof b.reviews === 'string' ? b.reviews : JSON.stringify(b.reviews);
    if (b.sourceVerified !== undefined) {
      deal.source_verified = b.sourceVerified ? 1 : 0;
      deal.source_sufficient = b.sourceVerified ? 1 : 0;
      if (!b.sourceVerified && deal.status === 'APPROVED') deal.status = 'PENDING_REVIEW';
    }
    if (b.sourceProvider !== undefined) deal.source_provider = b.sourceProvider;
    if (b.rawSourceData !== undefined) deal.raw_source_data = b.rawSourceData;
    if (b.status !== undefined) {
      if (!validStatus(b.status)) throw new Error('Invalid deal status');
      if (b.status === 'APPROVED' && deal.source_verified !== 1) throw new Error('Only source-verified deals can be approved');
      deal.status = b.status;
    }
    db.saveDb();
    res.json(rowToDeal(deal));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/approve-all', requireAdmin, (_req, res) => {
  let updatedCount = 0;
  for (const deal of db.tables.deals || []) {
    if (deal.status === 'PENDING_REVIEW' && deal.source_verified === 1) {
      deal.status = 'APPROVED';
      updatedCount += 1;
    }
  }
  if (updatedCount) db.saveDb();
  res.json({ success: true, approvedCount: updatedCount });
});

router.post('/bulk-status', requireAdmin, (req, res) => {
  const { ids = [], status = 'APPROVED' } = req.body || {};
  if (!Array.isArray(ids) || !validStatus(status)) return res.status(400).json({ error: 'Invalid ids or status' });
  let updatedCount = 0;
  for (const deal of db.tables.deals || []) {
    if ((ids.includes(deal.id) || ids.includes(deal.asin)) && (status !== 'APPROVED' || deal.source_verified === 1)) {
      deal.status = status;
      updatedCount += 1;
    }
  }
  if (updatedCount) db.saveDb();
  res.json({ success: true, updatedCount });
});

router.post('/:id/expire', requireAdmin, (req, res) => {
  const updated = db.expireDeal(req.params.id, req.body?.reason || 'Manually marked as expired by Admin');
  if (!updated) return res.status(404).json({ error: 'Deal not found' });
  res.json({ success: true, deal: rowToDeal(updated) });
});

router.post('/:id/restore', requireAdmin, (req, res) => {
  const deal = db.tables.deals.find((d) => d.id === req.params.id || d.asin === req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  if (deal.source_verified !== 1) return res.status(409).json({ error: 'Unverified deal cannot be restored to active status' });
  const updated = db.restoreDeal(req.params.id);
  res.json({ success: true, deal: rowToDeal(updated) });
});

router.post('/purge-expired', requireAdmin, (req, res) => {
  const hours = Number(req.body?.maxAgeHours ?? 24);
  if (!Number.isFinite(hours) || hours < 1) return res.status(400).json({ error: 'Invalid maxAgeHours' });
  res.json({ success: true, ...db.purgeExpiredDeals(hours * 3600) });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const index = db.tables.deals.findIndex((x) => x.id === req.params.id || x.asin === req.params.id);
  if (index !== -1) {
    db.tables.deals.splice(index, 1);
    db.saveDb();
  }
  res.json({ success: true });
});

module.exports = router;
