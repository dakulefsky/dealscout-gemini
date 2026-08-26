const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

function rowToDeal(r) {
  if (!r) return null;
  let parsedReviews = [];
  try { parsedReviews = typeof r.reviews === 'string' ? JSON.parse(r.reviews) : (r.reviews || []); } catch { parsedReviews = []; }
  const now = Math.floor(Date.now() / 1000);
  const isExpired = Boolean(r.is_expired === 1 || r.status === 'EXPIRED');
  const expiredAt = r.expired_at || null;
  const purgeInSeconds = isExpired && expiredAt ? Math.max(0, 86400 - (now - expiredAt)) : null;
  return {
    id: r.id, title: r.title, asin: r.asin, category: r.category,
    originalPrice: Number(r.original_price ?? r.originalPrice ?? 0), salePrice: Number(r.sale_price ?? r.salePrice ?? 0),
    discountPercent: Number(r.discount_percent ?? r.discountPercent ?? 0),
    imageUrl: r.image_url || r.imageUrl, productUrl: r.product_url || r.productUrl,
    rating: Number(r.rating ?? 0), ratingsTotal: Number(r.ratings_total ?? r.ratingsTotal ?? 0),
    shortBio: r.short_bio || r.shortBio, fullSummary: r.full_summary || r.fullSummary,
    pros: r.pros, cons: r.cons, reviews: parsedReviews,
    sourceSufficient: r.source_sufficient === 1 || r.sourceSufficient === true,
    sourceVerified: r.source_verified === 1 || r.sourceVerified === true,
    sourceProvider: r.source_provider || r.sourceProvider || null,
    status: r.status, isExpired, expiredAt,
    purgeInSeconds, purgeInHours: purgeInSeconds === null ? null : Number((purgeInSeconds / 3600).toFixed(1)),
    priceCheckAt: r.price_check_at || null, rawSourceData: r.raw_source_data || r.rawSourceData,
    created_date: r.created_at ? new Date(r.created_at * 1000).toISOString() : null,
  };
}

router.get('/stats', (req, res) => {
  const deals = db.tables.deals || [];
  const approved = deals.filter((d) => !d.is_expired && d.status === 'APPROVED');
  const pending = deals.filter((d) => d.status === 'PENDING_REVIEW');
  const expired = deals.filter((d) => d.is_expired === 1 || d.status === 'EXPIRED');
  const rejected = deals.filter((d) => d.status === 'REJECTED');
  const avgDiscount = approved.length ? Math.round(approved.reduce((a, d) => a + Number(d.discount_percent || 0), 0) / approved.length) : 0;
  const lifecycle = db.getDealLifecycleStats();
  res.json({ total: deals.length, approvedCount: approved.length, pendingCount: pending.length, expiredCount: expired.length, rejectedCount: rejected.length, readyToPurgeCount: lifecycle.readyToPurgeCount, avgDiscount, categoriesCount: (db.tables.categories || []).length, bookmarksCount: (db.tables.bookmarks || []).length, lifecycle });
});

router.get('/:id/price-history', (req, res) => {
  const deal = db.tables.deals.find((d) => d.id === req.params.id || d.asin === req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  res.json({ history: db.getDealPriceHistory(deal), deal: rowToDeal(deal) });
});

router.get('/', (req, res) => {
  const { status, category, q, minDiscount, maxPrice, minPrice, minRating, sort = '-created_date', limit = 100 } = req.query;
  let list = [...(db.tables.deals || [])];
  if (status) list = list.filter((d) => d.status === status);
  if (category && category !== 'All' && category !== 'All Deals') list = list.filter((d) => d.category && d.category.toLowerCase() === category.toLowerCase());
  if (q && typeof q === 'string' && q.trim()) {
    const term = q.trim().toLowerCase();
    list = list.filter((d) => [d.title, d.short_bio, d.full_summary, d.asin, d.category].some((v) => String(v || '').toLowerCase().includes(term)));
  }
  const minD = Number(minDiscount), minP = Number(minPrice), maxP = Number(maxPrice), minR = Number(minRating);
  if (Number.isFinite(minD)) list = list.filter((d) => Number(d.discount_percent || 0) >= minD);
  if (Number.isFinite(minP)) list = list.filter((d) => Number(d.sale_price || 0) >= minP);
  if (Number.isFinite(maxP)) list = list.filter((d) => Number(d.sale_price || 0) <= maxP);
  if (Number.isFinite(minR)) list = list.filter((d) => Number(d.rating || 0) >= minR);
  if (sort === 'discount_desc' || sort === '-discount_percent') list.sort((a, b) => Number(b.discount_percent || 0) - Number(a.discount_percent || 0));
  else if (sort === 'price_asc') list.sort((a, b) => Number(a.sale_price || 0) - Number(b.sale_price || 0));
  else if (sort === 'price_desc') list.sort((a, b) => Number(b.sale_price || 0) - Number(a.sale_price || 0));
  else if (sort === 'rating_desc') list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  else if (sort === 'created_date' || sort === 'created_at') list.sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0));
  else list.sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 100);
  res.json(list.slice(0, safeLimit).map(rowToDeal));
});

const { ensureDealHasReviews } = require('../services/rainforestService');

router.get('/:id', async (req, res) => {
  const row = db.tables.deals.find((x) => x.id === req.params.id || x.asin === req.params.id);
  if (!row) return res.status(404).json({ error: 'Deal not found' });
  let reviews = [];
  try { reviews = typeof row.reviews === 'string' ? JSON.parse(row.reviews) : (row.reviews || []); } catch {}
  if (reviews.length === 0 && row.source_verified) {
    try { await ensureDealHasReviews(row, db); } catch (err) { console.warn(`[reviews ${row.asin || row.id}]`, err.message); }
  }
  res.json(rowToDeal(row));
});

router.post('/:id/sync-reviews', requireAdmin, async (req, res) => {
  const row = db.tables.deals.find((x) => x.id === req.params.id || x.asin === req.params.id);
  if (!row) return res.status(404).json({ error: 'Deal not found' });
  if (!row.source_verified) return res.status(409).json({ error: 'Reviews can only be synchronized for source-verified deals' });
  row.reviews = '[]';
  try {
    const reviews = await ensureDealHasReviews(row, db);
    db.saveDb();
    return res.json({ success: true, dealId: row.id, asin: row.asin, reviews, count: reviews.length, deal: rowToDeal(row) });
  } catch (err) { return res.status(502).json({ error: 'Unable to synchronize reviews', detail: err.message }); }
});

function buildDealFromBody(b) {
  const asin = String(b.asin || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error('A valid 10-character Amazon ASIN is required');
  const original = Number(b.originalPrice), sale = Number(b.salePrice);
  if (!Number.isFinite(original) || !Number.isFinite(sale) || original <= 0 || sale < 0 || sale > original) throw new Error('Invalid price values');
  const discount = Number((((original - sale) / original) * 100).toFixed(1));
  const status = b.status || 'PENDING_REVIEW';
  if (!['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'].includes(status)) throw new Error('Invalid deal status');
  if (status === 'APPROVED' && b.sourceVerified !== true) throw new Error('A deal must be source-verified before approval');
  return {
    id: asin, title: String(b.title || '').trim(), asin, category: String(b.category || 'Electronics').trim(),
    original_price: original, sale_price: sale, discount_percent: discount,
    image_url: b.imageUrl || '', product_url: b.productUrl || `https://www.amazon.com/dp/${asin}`,
    rating: Number.isFinite(Number(b.rating)) ? Number(b.rating) : 0, ratings_total: Number.isFinite(Number(b.ratingsTotal)) ? Number(b.ratingsTotal) : 0,
    short_bio: b.shortBio || '', full_summary: b.fullSummary || '',
    pros: Array.isArray(b.pros) ? b.pros.join('\n') : (b.pros || ''), cons: Array.isArray(b.cons) ? b.cons.join('\n') : (b.cons || ''),
    reviews: typeof b.reviews === 'string' ? b.reviews : JSON.stringify(b.reviews || []),
    source_sufficient: b.sourceSufficient === true ? 1 : 0, source_verified: b.sourceVerified === true ? 1 : 0,
    source_provider: b.sourceProvider || null, status, raw_source_data: b.rawSourceData || '', created_at: Math.floor(Date.now() / 1000),
  };
}

router.post('/', requireAdmin, (req, res) => {
  try {
    const dealObj = buildDealFromBody(req.body || {});
    const existIdx = db.tables.deals.findIndex((d) => d.id === dealObj.id || d.asin === dealObj.asin);
    if (existIdx !== -1) db.tables.deals[existIdx] = { ...db.tables.deals[existIdx], ...dealObj };
    else db.tables.deals.unshift(dealObj);
    db.saveDb();
    res.status(existIdx === -1 ? 201 : 200).json(rowToDeal(dealObj));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:id', requireAdmin, (req, res) => {
  const d = db.tables.deals.find((x) => x.id === req.params.id || x.asin === req.params.id);
  if (!d) return res.status(404).json({ error: 'Deal not found' });
  const b = req.body || {};
  if (b.asin !== undefined) {
    const asin = String(b.asin).trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) return res.status(400).json({ error: 'Invalid ASIN' });
    d.asin = asin;
  }
  if (b.title !== undefined) d.title = String(b.title).trim();
  if (b.category !== undefined) d.category = String(b.category).trim();
  if (b.originalPrice !== undefined || b.salePrice !== undefined) {
    const original = Number(b.originalPrice ?? d.original_price), sale = Number(b.salePrice ?? d.sale_price);
    if (!Number.isFinite(original) || !Number.isFinite(sale) || original <= 0 || sale < 0 || sale > original) return res.status(400).json({ error: 'Invalid price values' });
    d.original_price = original; d.sale_price = sale; d.discount_percent = Number((((original - sale) / original) * 100).toFixed(1));
  }
  if (b.imageUrl !== undefined) d.image_url = b.imageUrl;
  if (b.productUrl !== undefined) d.product_url = b.productUrl;
  if (b.rating !== undefined) d.rating = Number(b.rating);
  if (b.ratingsTotal !== undefined) d.ratings_total = Number(b.ratingsTotal);
  if (b.shortBio !== undefined) d.short_bio = b.shortBio;
  if (b.fullSummary !== undefined) d.full_summary = b.fullSummary;
  if (b.pros !== undefined) d.pros = Array.isArray(b.pros) ? b.pros.join('\n') : b.pros;
  if (b.cons !== undefined) d.cons = Array.isArray(b.cons) ? b.cons.join('\n') : b.cons;
  if (b.reviews !== undefined) d.reviews = typeof b.reviews === 'string' ? b.reviews : JSON.stringify(b.reviews);
  if (b.sourceSufficient !== undefined) d.source_sufficient = b.sourceSufficient ? 1 : 0;
  if (b.sourceVerified !== undefined) d.source_verified = b.sourceVerified ? 1 : 0;
  if (b.sourceProvider !== undefined) d.source_provider = b.sourceProvider;
  if (b.rawSourceData !== undefined) d.raw_source_data = b.rawSourceData;
  if (b.status !== undefined) {
    if (!['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'].includes(b.status)) return res.status(400).json({ error: 'Invalid deal status' });
    if (b.status === 'APPROVED' && d.source_verified !== 1) return res.status(400).json({ error: 'A deal must be source-verified before approval' });
    d.status = b.status;
  }
  db.saveDb();
  res.json(rowToDeal(d));
});

router.post('/approve-all', requireAdmin, (req, res) => {
  const deals = db.tables.deals || []; let updatedCount = 0;
  for (const d of deals) if (d.status === 'PENDING_REVIEW' && d.source_verified === 1) { d.status = 'APPROVED'; updatedCount += 1; }
  db.saveDb();
  res.json({ success: true, approvedCount: updatedCount });
});

router.post('/bulk-status', requireAdmin, (req, res) => {
  const { ids = [], status = 'APPROVED' } = req.body || {};
  if (!Array.isArray(ids) || !['APPROVED', 'PENDING_REVIEW', 'REJECTED', 'EXPIRED'].includes(status)) return res.status(400).json({ error: 'Invalid ids or status' });
  const deals = db.tables.deals || []; let updatedCount = 0;
  for (const d of deals) if (ids.includes(d.id) || ids.includes(d.asin)) { if (status !== 'APPROVED' || d.source_verified === 1) { d.status = status; updatedCount += 1; } }
  db.saveDb();
  res.json({ success: true, updatedCount });
});

router.post('/:id/expire', requireAdmin, (req, res) => {
  const updated = db.expireDeal(req.params.id, (req.body || {}).reason || 'Manually marked as expired by Admin');
  if (!updated) return res.status(404).json({ error: 'Deal not found' });
  res.json({ success: true, deal: rowToDeal(updated) });
});

router.post('/:id/restore', requireAdmin, (req, res) => {
  const updated = db.restoreDeal(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Deal not found' });
  res.json({ success: true, deal: rowToDeal(updated) });
});

router.post('/purge-expired', requireAdmin, (req, res) => {
  const maxAgeHours = Number((req.body || {}).maxAgeHours ?? 24);
  if (!Number.isFinite(maxAgeHours) || maxAgeHours < 0) return res.status(400).json({ error: 'Invalid maxAgeHours' });
  res.json({ success: true, ...db.purgeExpiredDeals(maxAgeHours * 3600) });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const idx = db.tables.deals.findIndex((x) => x.id === req.params.id || x.asin === req.params.id);
  if (idx !== -1) { db.tables.deals.splice(idx, 1); db.saveDb(); }
  res.json({ success: true });
});

module.exports = router;