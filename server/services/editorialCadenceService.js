function stableBucket(value = '') {
  const text = String(value || '').trim().toUpperCase();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

// Random editorial sampling is opt-in. The default review queue should contain
// actual exceptions, not a percentage of otherwise-safe deals.
function getHoldbackPercent() {
  const raw = Number(process.env.EDITORIAL_HOLDBACK_PERCENT ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function requiresHumanEditorialReview(item = {}, percent = getHoldbackPercent()) {
  const asin = String(item.asin || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) return false;
  const normalizedPercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return stableBucket(asin) < normalizedPercent;
}

function publishingDecision(item = {}, quality = {}) {
  if (quality.decision === 'REJECT') return { status: 'REJECTED', reason: 'QUALITY_REJECT' };
  if (quality.decision !== 'AUTO_APPROVE') return { status: 'PENDING_REVIEW', reason: 'QUALITY_PENDING' };
  if (requiresHumanEditorialReview(item)) return { status: 'PENDING_REVIEW', reason: 'EDITORIAL_HOLDBACK' };
  return { status: 'APPROVED', reason: 'AUTO_APPROVED' };
}

module.exports = { stableBucket, getHoldbackPercent, requiresHumanEditorialReview, publishingDecision };
