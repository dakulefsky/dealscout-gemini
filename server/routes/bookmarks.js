const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const users = require('../repositories/userRepository');
const deals = require('../repositories/dealRepository');
const bookmarks = require('../repositories/bookmarkRepository');
const bookmarkQueries = require('../repositories/bookmarkQueryRepository');
const { normalizeGuestId, isValidGuestId } = require('../services/clientIdentityService');
const { isPublicDeal } = require('../services/publicDealPolicy');

const JWT_SECRET = process.env.JWT_SECRET;

async function getClientIdentity(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ') && JWT_SECRET && JWT_SECRET.length >= 32) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      const user = await users.findById(decoded.id);
      const tokenVersion = Number(decoded.authVersion || 0);
      const currentVersion = Number(user?.token_version || 0);
      if (user && tokenVersion === currentVersion) {
        return { id: user.id, email: user.email, authenticated: true, verified: user.verified === 1 || user.verified === true };
      }
    } catch {}
  }
  const guestId = normalizeGuestId(req.headers['x-guest-id']);
  if (!isValidGuestId(guestId)) return null;
  return { id: guestId, email: null, authenticated: false, verified: false };
}

function rowToPublicDeal(r) {
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
    qualityScore: Number(r.quality_score ?? 0),
    sourceVerified: r.source_verified === 1,
    priceCheckAt: r.price_check_at || null,
    created_date: r.created_at ? new Date(Number(r.created_at) * 1000).toISOString() : null,
  };
}

router.use(async (req, res, next) => {
  try {
    const identity = await getClientIdentity(req);
    if (!identity) return res.status(400).json({ error: 'A valid user or guest identity is required' });
    req.clientIdentity = identity;
    next();
  } catch (err) {
    console.error('[bookmarks] identity lookup failed:', err.message);
    res.status(503).json({ error: 'Bookmark service is temporarily unavailable' });
  }
});

router.get('/', async (req, res) => {
  try {
    const rows = await bookmarkQueries.listPublicSavedDeals(req.clientIdentity.id);
    const savedDeals = rows
      .filter((row) => isPublicDeal(row))
      .map((row) => ({
        ...rowToPublicDeal(row),
        savedAt: row.bookmark_created_at == null ? null : Number(row.bookmark_created_at),
        targetPrice: row.bookmark_target_price == null ? null : Number(row.bookmark_target_price),
      }));
    res.json({ deals: savedDeals, bookmarkIds: savedDeals.map((deal) => deal.id) });
  } catch (err) {
    console.error('[bookmarks] list failed:', err.message);
    res.status(503).json({ error: 'Bookmark service is temporarily unavailable' });
  }
});

router.post('/toggle', async (req, res) => {
  const userId = req.clientIdentity.id;
  const dealId = String(req.body?.dealId || '');
  if (!dealId) return res.status(400).json({ error: 'dealId is required' });
  try {
    const deal = await deals.findByIdOrAsin(dealId);
    if (!isPublicDeal(deal)) return res.status(404).json({ error: 'Deal not found' });
    const targetPrice = req.body?.targetPrice == null ? null : Number(req.body.targetPrice);
    if (targetPrice !== null && (!Number.isFinite(targetPrice) || targetPrice <= 0)) return res.status(400).json({ error: 'Invalid target price' });
    const result = await bookmarks.toggleBookmark(userId, deal.id, targetPrice);
    res.json({ success: true, isSaved: result.isSaved, dealId: deal.id, totalSaved: await bookmarks.countBookmarks(userId) });
  } catch (err) {
    console.error('[bookmarks] toggle failed:', err.message);
    res.status(503).json({ error: 'Bookmark service is temporarily unavailable' });
  }
});

router.post('/price-alert', async (req, res) => {
  const identity = req.clientIdentity;
  const dealId = String(req.body?.dealId || '');
  const targetPrice = Number(req.body?.targetPrice);
  if (!dealId || !Number.isFinite(targetPrice) || targetPrice <= 0) return res.status(400).json({ error: 'dealId and a positive targetPrice are required' });
  if (!identity.authenticated || !identity.verified || !identity.email) {
    return res.status(403).json({ error: 'A verified account email is required for price alerts' });
  }
  try {
    const deal = await deals.findByIdOrAsin(dealId);
    if (!isPublicDeal(deal)) return res.status(404).json({ error: 'Deal not found' });

    const email = String(identity.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid verified email is required for price alerts' });

    const alert = await bookmarks.upsertAlert({ userId: identity.id, deal, targetPrice, email });
    await bookmarks.setBookmarkTarget(identity.id, deal.id, targetPrice);
    res.json({
      success: true,
      message: `Price alert set for $${targetPrice}.`,
      alert: { id: alert.id, dealId: alert.dealId, targetPrice: alert.targetPrice, status: alert.status },
    });
  } catch (err) {
    console.error('[bookmarks] price alert failed:', err.message);
    res.status(503).json({ error: 'Bookmark service is temporarily unavailable' });
  }
});

module.exports = router;
