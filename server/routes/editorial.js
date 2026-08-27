const express = require('express');
const router = express.Router();
const deals = require('../repositories/dealRepository');
const editorial = require('../repositories/editorialRepository');
const { optionalAuth, requireAdmin } = require('../middleware/auth');

const AFFILIATE_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';

function publicShape(row) {
  return {
    asin: row?.asin || null,
    editorialNote: row?.editorial_note || '',
    isHumanPick: row?.is_human_pick === true,
    reviewedAt: row?.reviewed_at || null,
    affiliateDisclosure: AFFILIATE_DISCLOSURE,
  };
}

router.get('/:asin', optionalAuth, async (req, res) => {
  const asin = String(req.params.asin || '').trim().toUpperCase();
  const deal = await deals.findByIdOrAsin(asin);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const canSee = req.user?.role === 'admin' || (deal.status === 'APPROVED' && deal.is_expired !== 1 && deal.source_verified === 1);
  if (!canSee) return res.status(404).json({ error: 'Deal not found' });

  const row = await editorial.getByAsin(asin);
  if (req.user?.role === 'admin') {
    return res.json({
      ...publicShape(row || { asin }),
      reviewedBy: row?.reviewed_by || null,
      updatedAt: row?.updated_at || null,
    });
  }
  res.json(publicShape(row || { asin }));
});

router.put('/:asin', requireAdmin, async (req, res) => {
  try {
    const asin = String(req.params.asin || '').trim().toUpperCase();
    const deal = await deals.findByIdOrAsin(asin);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    if (deal.source_verified !== 1) return res.status(409).json({ error: 'Only source-verified deals can receive editorial approval' });

    const reviewer = req.user.email || req.user.name || req.user.id || 'admin';
    const row = await editorial.upsert({
      asin,
      editorialNote: req.body?.editorialNote,
      isHumanPick: req.body?.isHumanPick === true,
      reviewedBy: reviewer,
      reviewedAt: Math.floor(Date.now() / 1000),
    });
    res.json({ success: true, ...publicShape(row), reviewedBy: row.reviewed_by, updatedAt: row.updated_at });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:asin', requireAdmin, async (req, res) => {
  const removed = await editorial.remove(req.params.asin);
  res.json({ success: true, removed });
});

module.exports = router;
