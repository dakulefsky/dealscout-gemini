const express = require('express');
const router = express.Router();
const deals = require('../repositories/dealRepository');
const { optionalAuth } = require('../middleware/auth');
const { getHistory } = require('../services/priceHistoryService');
const { isPublicDeal } = require('../services/publicDealPolicy');

function canSeeDeal(req, deal) {
  return req.user?.role === 'admin' || isPublicDeal(deal);
}

router.get('/:id/price-history', optionalAuth, async (req, res) => {
  try {
    const deal = await deals.findByIdOrAsin(req.params.id);
    if (!deal || !canSeeDeal(req, deal)) return res.status(404).json({ error: 'Deal not found' });
    const history = await getHistory(deal.asin);
    const publicHistory = history.map((point) => ({
      date: point.date,
      price: Number(point.price),
      listPrice: Number(point.listPrice),
    }));
    res.json({ history: publicHistory, asin: deal.asin, hasObservedHistory: publicHistory.length > 0 });
  } catch (err) {
    console.error('[PriceHistory] Lookup failed:', err.message);
    res.status(503).json({ error: 'Price history is temporarily unavailable' });
  }
});

module.exports = router;
