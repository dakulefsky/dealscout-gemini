const express = require('express');
const { getAmazonBounties } = require('../services/amazonBounties');

const router = express.Router();
router.get('/', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=900');
  res.json({ programs: getAmazonBounties() });
});

module.exports = router;
