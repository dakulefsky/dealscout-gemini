const db = require('../db');
const postgres = require('../storage/postgres');
const bookmarks = require('./bookmarkRepository');
const deals = require('./dealRepository');

const CLAIM_TTL_SECONDS = 15 * 60;
let claimSchemaReady = false;

function nowUnix() { return Math.floor(Date.now() / 1000); }

function mapAlert(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    dealId: row.deal_id,
    dealTitle: row.deal_title,
    currentPrice: Number(row.current_price),
    targetPrice: Number(row.target_price),
    email: row.email,
    status: row.status,
    createdAt: Number(row.created_at),
    deliveryClaimedAt: row.delivery_claimed_at == null ? null : Number(row.delivery_claimed_at),
  };
}

async function ensureClaimSchema() {
  if (!postgres.isConfigured() || claimSchemaReady) return;
  await bookmarks.ensureSchema();
  await postgres.query('ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS delivery_claimed_at BIGINT');
  claimSchemaReady = true;
}

async function claimEligible(asin, salePrice) {
  const sale = Number(salePrice);
  if (!Number.isFinite(sale) || sale <= 0) return [];
  const claimedAt = nowUnix();
  const staleBefore = claimedAt - CLAIM_TTL_SECONDS;

  if (!postgres.isConfigured()) {
    const deal = await deals.findByIdOrAsin(asin);
    if (!deal) return [];
    const claimed = [];
    for (const alert of db.tables.price_alerts || []) {
      const staleClaim = alert.status === 'DELIVERING' && Number(alert.deliveryClaimedAt || 0) < staleBefore;
      if (alert.dealId !== deal.id || (!staleClaim && alert.status !== 'ACTIVE') || Number(alert.targetPrice) < sale) continue;
      alert.status = 'DELIVERING';
      alert.currentPrice = sale;
      alert.deliveryClaimedAt = claimedAt;
      claimed.push({ ...alert });
    }
    if (claimed.length) db.saveDb();
    return claimed;
  }

  await ensureClaimSchema();
  const result = await postgres.query(`
    UPDATE price_alerts AS alert
       SET status = 'DELIVERING', current_price = $2, delivery_claimed_at = $3
      FROM deals AS deal
     WHERE alert.deal_id = deal.id
       AND deal.asin = $1
       AND (alert.status = 'ACTIVE'
            OR (alert.status = 'DELIVERING' AND COALESCE(alert.delivery_claimed_at, 0) < $4))
       AND alert.target_price >= $2
    RETURNING alert.*
  `, [String(asin || '').trim().toUpperCase(), sale, claimedAt, staleBefore]);
  return result.rows.map(mapAlert);
}

async function markTriggered(id) {
  if (!postgres.isConfigured()) {
    const alert = (db.tables.price_alerts || []).find((row) => row.id === id);
    if (!alert || alert.status !== 'DELIVERING') return false;
    alert.status = 'TRIGGERED';
    alert.deliveryClaimedAt = null;
    db.saveDb();
    return true;
  }
  await ensureClaimSchema();
  const result = await postgres.query(
    "UPDATE price_alerts SET status = 'TRIGGERED', delivery_claimed_at = NULL WHERE id = $1 AND status = 'DELIVERING'",
    [id]
  );
  return result.rowCount > 0;
}

async function releaseClaim(id) {
  if (!postgres.isConfigured()) {
    const alert = (db.tables.price_alerts || []).find((row) => row.id === id);
    if (!alert || alert.status !== 'DELIVERING') return false;
    alert.status = 'ACTIVE';
    alert.deliveryClaimedAt = null;
    db.saveDb();
    return true;
  }
  await ensureClaimSchema();
  const result = await postgres.query(
    "UPDATE price_alerts SET status = 'ACTIVE', delivery_claimed_at = NULL WHERE id = $1 AND status = 'DELIVERING'",
    [id]
  );
  return result.rowCount > 0;
}

module.exports = { CLAIM_TTL_SECONDS, claimEligible, markTriggered, releaseClaim };
