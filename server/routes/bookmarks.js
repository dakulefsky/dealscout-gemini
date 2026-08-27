const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const users = require('../repositories/userRepository');
const deals = require('../repositories/dealRepository');

const JWT_SECRET = process.env.JWT_SECRET;
const GUEST_ID_RE = /^guest_[a-z0-9]{9,64}$/i;

async function getClientIdentity(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ') && JWT_SECRET && JWT_SECRET.length >= 32) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      const user = await users.findById(decoded.id);
      if (user) return { id: user.id, email: user.email, authenticated: true };
    } catch {}
  }
  const guestId = String(req.headers['x-guest-id'] || '');
  if (!GUEST_ID_RE.test(guestId)) return null;
  return { id: guestId, email: null, authenticated: false };
}

function publicDeal(deal) {
  return deal && deal.status === 'APPROVED' && deal.is_expired !== 1 && deal.source_verified === 1;
}

function rowToDeal(r) {
  return {
    id: r.id,
    title: r.title,
    asin: r.asin,
    category: r.category,
    originalPrice: Number(r.original_price || 0),
    salePrice: Number(r.sale_price || 0),
    discountPercent: Number(r.discount_percent || 0),
    imageUrl: r.image_url,
    productUrl: r.product_url,
    rating: Number(r.rating || 0),
    ratingsTotal: Number(r.ratings_total || 0),
    shortBio: r.short_bio,
    fullSummary: r.full_summary,
    pros: r.pros,
    cons: r.cons,
    reviews: Array.isArray(r.reviews) ? r.reviews : [],
    sourceVerified: r.source_verified === 1,
    status: r.status,
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
    const userId = req.clientIdentity.id;
    const userBookmarks = db.tables.bookmarks.filter((b) => b.userId === userId);
    const savedDeals = [];
    for (const bookmark of userBookmarks) {
      const deal = await deals.findByIdOrAsin(bookmark.dealId);
      if (!publicDeal(deal)) continue;
      savedDeals.push({ ...rowToDeal(deal), savedAt: bookmark.createdAt || null, targetPrice: bookmark.targetPrice || null });
    }
    res.json({ deals: savedDeals, bookmarkIds: savedDeals.map((d) => d.id) });
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
    if (!publicDeal(deal)) return res.status(404).json({ error: 'Deal not found' });

    const existingIndex = db.tables.bookmarks.findIndex((b) => b.userId === userId && b.dealId === deal.id);
    let isSaved;
    if (existingIndex !== -1) {
      db.tables.bookmarks.splice(existingIndex, 1);
      isSaved = false;
    } else {
      const targetPrice = req.body?.targetPrice == null ? null : Number(req.body.targetPrice);
      if (targetPrice !== null && (!Number.isFinite(targetPrice) || targetPrice <= 0)) return res.status(400).json({ error: 'Invalid target price' });
      db.tables.bookmarks.push({ id: uuidv4(), userId, dealId: deal.id, targetPrice, createdAt: Math.floor(Date.now() / 1000) });
      isSaved = true;
    }
    db.saveDb();
    res.json({ success: true, isSaved, dealId: deal.id, totalSaved: db.tables.bookmarks.filter((b) => b.userId === userId).length });
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
  try {
    const deal = await deals.findByIdOrAsin(dealId);
    if (!publicDeal(deal)) return res.status(404).json({ error: 'Deal not found' });

    const suppliedEmail = String(req.body?.email || '').trim().toLowerCase();
    const email = identity.authenticated ? identity.email : suppliedEmail;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid email is required for price alerts' });

    const alertIndex = db.tables.price_alerts.findIndex((a) => a.userId === identity.id && a.dealId === deal.id);
    const alert = {
      id: alertIndex !== -1 ? db.tables.price_alerts[alertIndex].id : uuidv4(),
      userId: identity.id,
      dealId: deal.id,
      dealTitle: deal.title,
      currentPrice: Number(deal.sale_price),
      targetPrice,
      email,
      status: 'ACTIVE',
      createdAt: alertIndex !== -1 ? db.tables.price_alerts[alertIndex].createdAt : Math.floor(Date.now() / 1000),
    };
    if (alertIndex !== -1) db.tables.price_alerts[alertIndex] = alert;
    else db.tables.price_alerts.push(alert);

    const bookmark = db.tables.bookmarks.find((b) => b.userId === identity.id && b.dealId === deal.id);
    if (bookmark) bookmark.targetPrice = targetPrice;
    else db.tables.bookmarks.push({ id: uuidv4(), userId: identity.id, dealId: deal.id, targetPrice, createdAt: Math.floor(Date.now() / 1000) });

    db.saveDb();
    res.json({ success: true, message: `Price alert set for $${targetPrice}.`, alert });
  } catch (err) {
    console.error('[bookmarks] price alert failed:', err.message);
    res.status(503).json({ error: 'Bookmark service is temporarily unavailable' });
  }
});

module.exports = router;
