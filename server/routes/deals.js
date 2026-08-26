const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

function rowToDeal(r) {
  if (!r) return null;
  let parsedReviews = [];
  try {
    parsedReviews = typeof r.reviews === 'string' ? JSON.parse(r.reviews) : (r.reviews || []);
  } catch {
    parsedReviews = [];
  }

  const now = Math.floor(Date.now() / 1000);
  const isExpired = Boolean(r.is_expired === 1 || r.status === 'EXPIRED');
  const expiredAt = r.expired_at || null;
  const expiresInSeconds = (isExpired && expiredAt)
    ? Math.max(0, 86400 - (now - expiredAt))
    : null;
  const expiresInHours = expiresInSeconds !== null ? Number((expiresInSeconds / 3600).toFixed(1)) : null;

  return {
    id: r.id,
    title: r.title,
    asin: r.asin,
    category: r.category,
    originalPrice: Number(r.original_price || r.originalPrice || 0),
    salePrice: Number(r.sale_price || r.salePrice || 0),
    discountPercent: Number(r.discount_percent || r.discountPercent || 0),
    imageUrl: r.image_url || r.imageUrl,
    productUrl: r.product_url || r.productUrl,
    rating: Number(r.rating || 4.5),
    ratingsTotal: Number(r.ratings_total || r.ratingsTotal || 100),
    shortBio: r.short_bio || r.shortBio,
    fullSummary: r.full_summary || r.fullSummary,
    pros: r.pros,
    cons: r.cons,
    reviews: parsedReviews,
    sourceSufficient: r.source_sufficient === 1 || r.sourceSufficient === true,
    status: r.status,
    isExpired,
    expiredAt,
    expiresInSeconds,
    expiresInHours,
    priceCheckAt: r.price_check_at || null,
    rawSourceData: r.raw_source_data || r.rawSourceData,
    created_date: r.created_at ? new Date(r.created_at * 1000).toISOString() : new Date().toISOString(),
  };
}

// GET /api/deals/stats
router.get('/stats', (req, res) => {
  const deals = db.tables.deals || [];
  const approved = deals.filter((d) => !d.is_expired && d.status === 'APPROVED');
  const pending = deals.filter((d) => d.status === 'PENDING_REVIEW');
  const expired = deals.filter((d) => d.is_expired === 1 || d.status === 'EXPIRED');
  const rejected = deals.filter((d) => d.status === 'REJECTED');
  const avgDiscount = approved.length
    ? Math.round(approved.reduce((acc, d) => acc + (d.discount_percent || 0), 0) / approved.length)
    : 0;

  const lifecycle = db.getDealLifecycleStats();

  res.json({
    total: deals.length,
    approvedCount: approved.length,
    pendingCount: pending.length,
    expiredCount: expired.length,
    rejectedCount: rejected.length,
    readyToPurgeCount: lifecycle.readyToPurgeCount,
    avgDiscount,
    categoriesCount: (db.tables.categories || []).length,
    bookmarksCount: (db.tables.bookmarks || []).length,
    lifecycle,
  });
});

// GET /api/deals/:id/price-history
router.get('/:id/price-history', (req, res) => {
  const deal = db.tables.deals.find((d) => d.id === req.params.id || d.asin === req.params.id);
  if (!deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }
  const history = db.getDealPriceHistory(deal);
  res.json({ history, deal: rowToDeal(deal) });
});

// GET /api/deals
router.get('/', (req, res) => {
  const {
    status,
    category,
    q,
    minDiscount,
    maxPrice,
    minPrice,
    minRating,
    sort = '-created_date',
    limit = 100
  } = req.query;

  let list = [...(db.tables.deals || [])];

  // Filter by status
  if (status) {
    list = list.filter((d) => d.status === status);
  }

  // Filter by category
  if (category && category !== 'All' && category !== 'All Deals') {
    list = list.filter((d) => d.category && d.category.toLowerCase() === category.toLowerCase());
  }

  // Search filter
  if (q && typeof q === 'string' && q.trim()) {
    const term = q.trim().toLowerCase();
    list = list.filter((d) =>
      (d.title && d.title.toLowerCase().includes(term)) ||
      (d.short_bio && d.short_bio.toLowerCase().includes(term)) ||
      (d.full_summary && d.full_summary.toLowerCase().includes(term)) ||
      (d.asin && d.asin.toLowerCase().includes(term)) ||
      (d.category && d.category.toLowerCase().includes(term))
    );
  }

  // Min discount filter
  if (minDiscount) {
    const minD = Number(minDiscount);
    if (!isNaN(minD)) {
      list = list.filter((d) => (d.discount_percent || 0) >= minD);
    }
  }

  // Price range filters
  if (minPrice) {
    const minP = Number(minPrice);
    if (!isNaN(minP)) {
      list = list.filter((d) => (d.sale_price || 0) >= minP);
    }
  }
  if (maxPrice) {
    const maxP = Number(maxPrice);
    if (!isNaN(maxP)) {
      list = list.filter((d) => (d.sale_price || 0) <= maxP);
    }
  }

  // Min rating filter
  if (minRating) {
    const minR = Number(minRating);
    if (!isNaN(minR)) {
      list = list.filter((d) => (d.rating || 0) >= minR);
    }
  }

  // Sorting
  if (sort === 'discount_desc' || sort === '-discount_percent') {
    list.sort((a, b) => (b.discount_percent || 0) - (a.discount_percent || 0));
  } else if (sort === 'price_asc') {
    list.sort((a, b) => (a.sale_price || 0) - (b.sale_price || 0));
  } else if (sort === 'price_desc') {
    list.sort((a, b) => (b.sale_price || 0) - (a.sale_price || 0));
  } else if (sort === 'rating_desc') {
    list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sort === 'created_date' || sort === 'created_at') {
    list.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
  } else {
    // Default -created_date
    list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  }

  const results = list.slice(0, Number(limit) || 100);
  res.json(results.map(rowToDeal));
});

const { ensureDealHasReviews } = require('../services/rainforestService');

// GET /api/deals/:id
router.get('/:id', async (req, res) => {
  const row = db.tables.deals.find((x) => x.id === req.params.id || x.asin === req.params.id);
  if (!row) return res.status(404).json({ error: 'Deal not found' });

  // Ensure substantive customer reviews are populated for this deal
  let reviews = [];
  try {
    reviews = typeof row.reviews === 'string' ? JSON.parse(row.reviews) : (row.reviews || []);
  } catch {
    reviews = [];
  }

  if (!reviews || reviews.length === 0) {
    try {
      await ensureDealHasReviews(row, db);
    } catch (err) {
      console.warn(`[deals/:id ensureDealHasReviews notice for ${row.asin || row.id}]:`, err.message);
    }
  }

  res.json(rowToDeal(row));
});

// POST /api/deals/:id/sync-reviews
// Force refresh or pull real customer reviews for a specific deal
router.post('/:id/sync-reviews', async (req, res) => {
  const row = db.tables.deals.find((x) => x.id === req.params.id || x.asin === req.params.id);
  if (!row) return res.status(404).json({ error: 'Deal not found' });

  // Clear existing to force fresh pull
  row.reviews = '[]';
  const reviews = await ensureDealHasReviews(row, db);

  res.json({
    success: true,
    dealId: row.id,
    asin: row.asin,
    reviews,
    count: reviews.length,
    deal: rowToDeal(row)
  });
});

// POST /api/deals  (admin only)
router.post('/', requireAdmin, (req, res) => {
  const b = req.body;
  const id = b.asin || uuidv4();
  const reviewsStr = typeof b.reviews === 'string' ? b.reviews : JSON.stringify(b.reviews || []);

  const dealObj = {
    id,
    title: b.title || 'Untitled Deal',
    asin: b.asin || id,
    category: b.category || 'Electronics',
    original_price: Number(b.originalPrice) || 0,
    sale_price: Number(b.salePrice) || 0,
    discount_percent: Number(b.discountPercent) || 0,
    image_url: b.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    product_url: b.productUrl || `https://www.amazon.com/dp/${b.asin || id}`,
    rating: Number(b.rating) || 4.7,
    ratings_total: Number(b.ratingsTotal) || 500,
    short_bio: b.shortBio || '',
    full_summary: b.fullSummary || '',
    pros: Array.isArray(b.pros) ? b.pros.join('\n') : (b.pros || ''),
    cons: Array.isArray(b.cons) ? b.cons.join('\n') : (b.cons || ''),
    reviews: reviewsStr,
    source_sufficient: b.sourceSufficient !== false ? 1 : 0,
    status: b.status || 'APPROVED',
    raw_source_data: b.rawSourceData || 'Manual / AI Entry',
    created_at: Math.floor(Date.now() / 1000),
  };

  // Replace or push
  const existIdx = db.tables.deals.findIndex((d) => d.id === id || d.asin === id);
  if (existIdx !== -1) {
    db.tables.deals[existIdx] = { ...db.tables.deals[existIdx], ...dealObj }; db.saveDb();
    return res.status(200).json(rowToDeal(db.tables.deals[existIdx]));
  }

  db.tables.deals.unshift(dealObj); db.saveDb();
  res.status(201).json(rowToDeal(dealObj));
});

// PATCH /api/deals/:id  (admin only)
router.patch('/:id', requireAdmin, (req, res) => {
  const b = req.body;
  const d = db.tables.deals.find((x) => x.id === req.params.id || x.asin === req.params.id);
  if (!d) return res.status(404).json({ error: 'Deal not found' });

  if (b.title !== undefined) d.title = b.title;
  if (b.asin !== undefined) d.asin = b.asin;
  if (b.category !== undefined) d.category = b.category;
  if (b.originalPrice !== undefined) d.original_price = Number(b.originalPrice);
  if (b.salePrice !== undefined) d.sale_price = Number(b.salePrice);
  if (b.discountPercent !== undefined) d.discount_percent = Number(b.discountPercent);
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
  if (b.status !== undefined) d.status = b.status;
  if (b.rawSourceData !== undefined) d.raw_source_data = b.rawSourceData;

  res.json(rowToDeal(d));
});

// POST /api/deals/approve-all (admin only)
router.post('/approve-all', requireAdmin, (req, res) => {
  const deals = db.tables.deals || [];
  let updatedCount = 0;
  for (const d of deals) {
    if (d.status === 'PENDING_REVIEW') {
      d.status = 'APPROVED';
      updatedCount += 1;
    }
  }
  res.json({ success: true, approvedCount: updatedCount });
});

// POST /api/deals/bulk-status (admin only)
router.post('/bulk-status', requireAdmin, (req, res) => {
  const { ids = [], status = 'APPROVED' } = req.body || {};
  const deals = db.tables.deals || [];
  let updatedCount = 0;
  for (const d of deals) {
    if (ids.includes(d.id) || ids.includes(d.asin)) {
      d.status = status;
      updatedCount += 1;
    }
  }
  res.json({ success: true, updatedCount });
});

// POST /api/deals/:id/expire (admin only) - manually marks deal as expired / ended
router.post('/:id/expire', requireAdmin, (req, res) => {
  const { reason = 'Manually marked as expired by Admin' } = req.body || {};
  const updated = db.expireDeal(req.params.id, reason);
  if (!updated) {
    return res.status(404).json({ error: 'Deal not found' });
  }
  res.json({ success: true, deal: rowToDeal(updated) });
});

// POST /api/deals/:id/restore (admin only) - restores an expired deal
router.post('/:id/restore', requireAdmin, (req, res) => {
  const updated = db.restoreDeal(req.params.id);
  if (!updated) {
    return res.status(404).json({ error: 'Deal not found' });
  }
  res.json({ success: true, deal: rowToDeal(updated) });
});

// POST /api/deals/purge-expired (admin only) - manually triggers 24h purge
router.post('/purge-expired', requireAdmin, (req, res) => {
  const { maxAgeHours = 24 } = req.body || {};
  const maxAgeSeconds = Number(maxAgeHours) * 3600;
  const result = db.purgeExpiredDeals(maxAgeSeconds);
  res.json({ success: true, ...result });
});

// DELETE /api/deals/:id  (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  const idx = db.tables.deals.findIndex((x) => x.id === req.params.id || x.asin === req.params.id);
  if (idx !== -1) {
    db.tables.deals.splice(idx, 1); db.saveDb();
  }
  res.json({ success: true });
});

module.exports = router;
