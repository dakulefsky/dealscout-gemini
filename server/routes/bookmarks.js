const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Helper to get user identifier (authenticated or guest token header)
function getClientIdentifier(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.id) return decoded.id;
    } catch {
      // Fallback
    }
  }
  return req.headers['x-guest-id'] || 'guest-default';
}

function rowToDeal(r) {
  if (!r) return null;
  let parsedReviews = [];
  try {
    parsedReviews = typeof r.reviews === 'string' ? JSON.parse(r.reviews) : (r.reviews || []);
  } catch {
    parsedReviews = [];
  }

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
    rawSourceData: r.raw_source_data || r.rawSourceData,
    created_date: r.created_at ? new Date(r.created_at * 1000).toISOString() : new Date().toISOString(),
  };
}

// GET /api/bookmarks - Get saved deals for current user/guest
router.get('/', (req, res) => {
  const userId = getClientIdentifier(req);
  const userBookmarks = db.tables.bookmarks.filter((b) => b.userId === userId);
  const dealIds = userBookmarks.map((b) => b.dealId);

  const savedDeals = db.tables.deals
    .filter((d) => dealIds.includes(d.id) || dealIds.includes(d.asin))
    .map((deal) => {
      const bm = userBookmarks.find((b) => b.dealId === deal.id || b.dealId === deal.asin);
      return {
        ...rowToDeal(deal),
        savedAt: bm ? bm.createdAt : Date.now(),
        targetPrice: bm ? bm.targetPrice : null,
      };
    });

  res.json({ deals: savedDeals, bookmarkIds: dealIds });
});

// POST /api/bookmarks/toggle - Toggle save status
router.post('/toggle', (req, res) => {
  const userId = getClientIdentifier(req);
  const { dealId, targetPrice } = req.body || {};

  if (!dealId) {
    return res.status(400).json({ error: 'dealId is required' });
  }

  const existingIdx = db.tables.bookmarks.findIndex(
    (b) => b.userId === userId && (b.dealId === dealId)
  );

  let isSaved = false;
  if (existingIdx !== -1) {
    db.tables.bookmarks.splice(existingIdx, 1); db.saveDb();
    isSaved = false;
  } else {
    db.tables.bookmarks.push({
      id: uuidv4(),
      userId,
      dealId,
      targetPrice: targetPrice ? Number(targetPrice) : null,
      createdAt: Math.floor(Date.now() / 1000),
    });
    isSaved = true;
  }

  res.json({
    success: true,
    isSaved,
    dealId,
    totalSaved: db.tables.bookmarks.filter((b) => b.userId === userId).length,
  });
});

// POST /api/bookmarks/price-alert - Set a price drop alert target
router.post('/price-alert', (req, res) => {
  const userId = getClientIdentifier(req);
  const { dealId, targetPrice, email } = req.body || {};

  if (!dealId || !targetPrice) {
    return res.status(400).json({ error: 'dealId and targetPrice are required' });
  }

  const deal = db.tables.deals.find((d) => d.id === dealId || d.asin === dealId);
  if (!deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  // Update or insert price alert
  const alertIdx = db.tables.price_alerts.findIndex((a) => a.userId === userId && a.dealId === dealId);
  const alertObj = {
    id: alertIdx !== -1 ? db.tables.price_alerts[alertIdx].id : uuidv4(),
    userId,
    dealId,
    dealTitle: deal.title,
    currentPrice: deal.sale_price || deal.price,
    targetPrice: Number(targetPrice),
    email: email || 'user@example.com',
    status: 'ACTIVE',
    createdAt: Math.floor(Date.now() / 1000),
  };

  if (alertIdx !== -1) {
    db.tables.price_alerts[alertIdx] = alertObj;
  } else {
    db.tables.price_alerts.push(alertObj); db.saveDb();
  }

  // Also ensure it's in bookmarks
  const bm = db.tables.bookmarks.find((b) => b.userId === userId && b.dealId === dealId);
  if (bm) {
    bm.targetPrice = Number(targetPrice);
  } else {
    db.tables.bookmarks.push({
      id: uuidv4(),
      userId,
      dealId,
      targetPrice: Number(targetPrice),
      createdAt: Math.floor(Date.now() / 1000),
    });
  }

  res.json({
    success: true,
    message: `Price alert set for $${targetPrice}. You'll be notified when the price matches or drops further.`,
    alert: alertObj,
  });
});

module.exports = router;
