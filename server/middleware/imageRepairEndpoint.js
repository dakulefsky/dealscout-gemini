const { repairMissingImages, imageHealth } = require('../services/imageRepairService');
const { requireAdmin } = require('./auth');

function imageRepairEndpoint(req, res, next) {
  const isRepair = req.method === 'POST' && req.path === '/repair-images';
  const isHealth = req.method === 'GET' && req.path === '/image-health';
  if (!isRepair && !isHealth) return next();

  return requireAdmin(req, res, async () => {
    try {
      if (isHealth) return res.json({ success: true, ...(await imageHealth()) });
      const result = await repairMissingImages(req.body?.limit || 20);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Image maintenance failed' });
    }
  });
}

module.exports = { imageRepairEndpoint };
