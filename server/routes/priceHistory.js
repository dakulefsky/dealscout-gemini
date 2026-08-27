const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { getHistory } = require('../services/priceHistoryService');

function canSeeDeal(req, deal) {
  return req.user?.role === 'admin' || (deal.status === 'APPROVED' && deal.is_expired !== 1 && deal.source_verified === 1);
}

router.get('/:id/price-history', optionalAuth, (req, res) => {
  const deal = (db.tables.deals || []).find((d) => d.id === req.params.id || d.asin === req.params.id);
  if (!deal || !canSeeDeal(req, deal)) return res.status(404).json({ error: 'Deal not found' });
  res.json({
    history: getHistory(deal.asin),
    asin: deal.asin,
    hasObservedHistory: getHistory(deal.asin).length > 0,
  });
});

module.exports = router;
