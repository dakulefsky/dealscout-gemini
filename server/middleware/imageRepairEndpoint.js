const { repairMissingImages, imageHealth } = require('../services/imageRepairService');
const { requireAdmin } = require('./auth');

function imageRepairEndpoint(req, res, next) {
  const isRepair = req.method === 'POST' && req.path === '/repair-images';
  const isHealth = req.method === 'GET' && req.path === '/image-health';
  if (!isRepair && !isHealth) return next();

  return requireAdmin(req, res, async () => {
    try {
      if (isHealth) return res.json({ success: true, ...(await imageHealth()) });
      const limit = Math.min(3, Math.max(1, Number(req.body?.limit) || 3));
      const result = await repairMissingImages(limit);
      if (result?.skipped) return res.status(409).json({ error: 'Image repair is already running. Wait a moment, then try again.', code: 'IMAGE_REPAIR_IN_PROGRESS' });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Image maintenance failed' });
    }
  });
}

module.exports = { imageRepairEndpoint };
