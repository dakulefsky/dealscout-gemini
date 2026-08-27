const express = require('express');
const router = express.Router();
const deals = require('../repositories/dealRepository');
const { optionalAuth } = require('../middleware/auth');
const { getHistory } = require('../services/priceHistoryService');

function canSeeDeal(req, deal) {
  return req.user?.role === 'admin' || (deal.status === 'APPROVED' && deal.is_expired !== 1 && deal.source_verified === 1);
}

router.get('/:id/price-history', optionalAuth, async (req, res) => {
  try {
    const deal = await deals.findByIdOrAsin(req.params.id);
    if (!deal || !canSeeDeal(req, deal)) return res.status(404).json({ error: 'Deal not found' });
    const history = await getHistory(deal.asin);
    res.json({ history, asin: deal.asin, hasObservedHistory: history.length > 0 });
  } catch (err) {
    console.error('[PriceHistory] Lookup failed:', err.message);
    res.status(503).json({ error: 'Price history is temporarily unavailable' });
  }
});

module.exports = router;
