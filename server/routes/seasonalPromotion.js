const express = require('express');
const { getActivePromotion } = require('../services/amazonSeasonalPromotion');

const router = express.Router();
router.get('/', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ promotion: await getActivePromotion() });
  } catch (error) {
    console.warn('[seasonal-promotion] lookup failed:', error.message);
    res.status(503).json({ error: 'Seasonal promotion is temporarily unavailable' });
  }
});

module.exports = router;
