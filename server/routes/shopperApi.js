const express = require('express');

function registrationGate(req, res, next) {
  if (process.env.ALLOW_PUBLIC_REGISTRATION === 'true') return next();
  return res.status(404).json({ error: 'Not found' });
}

function buildShopperApi({ version = null } = {}) {
  const router = express.Router();

  if (version) {
    router.use((_req, res, next) => {
      res.setHeader('X-DealScout-API-Version', String(version));
      next();
    });
  }

  router.use('/auth/register', registrationGate);
  router.use('/auth', require('./auth'));
  router.use('/deals', require('./priceHistory'));
  router.use('/deals', require('../middleware/verifiedAiIngestGuard').verifiedAiIngestGuard);
  router.use('/deals', require('./deals'));
  router.use('/categories', require('./categories'));
  router.use('/bookmarks', require('./bookmarks'));

  if (version) {
    router.get('/meta', (_req, res) => res.json({ apiVersion: String(version) }));
  }

  return router;
}

module.exports = { buildShopperApi, registrationGate };
