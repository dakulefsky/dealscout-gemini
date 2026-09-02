const express = require('express');
const router = express.Router();
const deals = require('../repositories/dealRepository');
const editorial = require('../repositories/editorialRepository');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const { isPublicDeal } = require('../services/publicDealPolicy');

const AFFILIATE_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';

function publicShape(row) {
  return {
    asin: row?.asin || null,
    editorialNote: row?.editorial_note || '',
    isHumanPick: row?.is_human_pick === true,
    reviewedAt: row?.reviewed_at || null,
    affiliateDisclosure: AFFILIATE_DISCLOSURE,
  };
}

function publicDealShape(row) {
  return {
    id: row.id,
    title: row.title,
    asin: row.asin,
    category: row.category,
    originalPrice: Number(row.original_price ?? 0),
    salePrice: Number(row.sale_price ?? 0),
    discountPercent: Number(row.discount_percent ?? 0),
    imageUrl: row.image_url,
    productUrl: row.product_url,
    shortBio: row.short_bio || '',
    sourceVerified: row.source_verified === 1,
    sourceProvider: row.source_provider || null,
    status: row.status,
    isExpired: row.is_expired === 1 || row.status === 'EXPIRED',
    priceCheckAt: row.price_check_at || null,
    created_date: row.created_at ? new Date(Number(row.created_at) * 1000).toISOString() : null,
  };
}

router.get('/picks', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 8, 1), 24);
    const rows = await editorial.listHumanPicks(Math.min(limit * 3, 50));
    const picks = [];
    for (const row of rows) {
      const deal = await deals.findByIdOrAsin(row.asin);
      if (!isPublicDeal(deal)) continue;
      picks.push({ ...publicShape(row), deal: publicDealShape(deal) });
      if (picks.length >= limit) break;
    }
    res.json({ picks, affiliateDisclosure: AFFILIATE_DISCLOSURE });
  } catch (err) {
    console.error('[editorial] picks failed:', err.message);
    res.status(503).json({ error: 'DealScout Picks are temporarily unavailable' });
  }
});

router.post('/batch', requireAdmin, async (req, res) => {
  try {
    const asins = Array.isArray(req.body?.asins) ? req.body.asins.slice(0, 100) : [];
    const rows = await editorial.listForAsins(asins);
    const byAsin = Object.fromEntries(rows.map((row) => [row.asin, {
      ...publicShape(row),
      reviewedBy: row.reviewed_by || null,
      updatedAt: row.updated_at || null,
    }]));
    res.json({ byAsin });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:asin', optionalAuth, async (req, res) => {
  const asin = String(req.params.asin || '').trim().toUpperCase();
  const deal = await deals.findByIdOrAsin(asin);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const canSee = req.user?.role === 'admin' || isPublicDeal(deal);
  if (!canSee) return res.status(404).json({ error: 'Deal not found' });

  const row = await editorial.getByAsin(asin);
  if (req.user?.role === 'admin') {
    return res.json({
      ...publicShape(row || { asin }),
      reviewedBy: row?.reviewed_by || null,
      updatedAt: row?.updated_at || null,
    });
  }
  res.json(publicShape(row || { asin }));
});

router.put('/:asin', requireAdmin, async (req, res) => {
  try {
    const asin = String(req.params.asin || '').trim().toUpperCase();
    const deal = await deals.findByIdOrAsin(asin);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    if (deal.source_verified !== 1) return res.status(409).json({ error: 'Only source-verified deals can receive editorial approval' });

    const reviewer = req.user.email || req.user.name || req.user.id || 'admin';
    const row = await editorial.upsert({
      asin,
      editorialNote: req.body?.editorialNote,
      isHumanPick: req.body?.isHumanPick === true,
      reviewedBy: reviewer,
      reviewedAt: Math.floor(Date.now() / 1000),
    });
    res.json({ success: true, ...publicShape(row), reviewedBy: row.reviewed_by, updatedAt: row.updated_at });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:asin', requireAdmin, async (req, res) => {
  const removed = await editorial.remove(req.params.asin);
  res.json({ success: true, removed });
});

module.exports = router;
