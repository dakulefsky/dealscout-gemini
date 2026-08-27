const { repairMissingImages } = require('../services/imageRepairService');
const { requireAdmin } = require('./auth');

function imageRepairEndpoint(req, res, next) {
  if (req.method !== 'POST' || req.path !== '/repair-images') return next();
  return requireAdmin(req, res, async () => {
    try {
      const result = await repairMissingImages(req.body?.limit || 20);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Image repair failed' });
    }
  });
}

module.exports = { imageRepairEndpoint };
