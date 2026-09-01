const db = require('../db');
const postgres = require('../storage/postgres');
const bookmarks = require('./bookmarkRepository');
const deals = require('./dealRepository');

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
  };
}

async function claimEligible(asin, salePrice) {
  const sale = Number(salePrice);
  if (!Number.isFinite(sale) || sale <= 0) return [];

  if (!postgres.isConfigured()) {
    const deal = await deals.findByIdOrAsin(asin);
    if (!deal) return [];
    const claimed = [];
    for (const alert of db.tables.price_alerts || []) {
      if (alert.dealId !== deal.id || alert.status !== 'ACTIVE' || Number(alert.targetPrice) < sale) continue;
      alert.status = 'DELIVERING';
      alert.currentPrice = sale;
      claimed.push({ ...alert });
    }
    if (claimed.length) db.saveDb();
    return claimed;
  }

  await bookmarks.ensureSchema();
  const result = await postgres.query(`
    UPDATE price_alerts AS alert
       SET status = 'DELIVERING', current_price = $2
      FROM deals AS deal
     WHERE alert.deal_id = deal.id
       AND deal.asin = $1
       AND alert.status = 'ACTIVE'
       AND alert.target_price >= $2
    RETURNING alert.*
  `, [String(asin || '').trim().toUpperCase(), sale]);
  return result.rows.map(mapAlert);
}

async function markTriggered(id) {
  if (!postgres.isConfigured()) {
    const alert = (db.tables.price_alerts || []).find((row) => row.id === id);
    if (!alert || alert.status !== 'DELIVERING') return false;
    alert.status = 'TRIGGERED';
    db.saveDb();
    return true;
  }
  await bookmarks.ensureSchema();
  const result = await postgres.query(
    "UPDATE price_alerts SET status = 'TRIGGERED' WHERE id = $1 AND status = 'DELIVERING'",
    [id]
  );
  return result.rowCount > 0;
}

async function releaseClaim(id) {
  if (!postgres.isConfigured()) {
    const alert = (db.tables.price_alerts || []).find((row) => row.id === id);
    if (!alert || alert.status !== 'DELIVERING') return false;
    alert.status = 'ACTIVE';
    db.saveDb();
    return true;
  }
  await bookmarks.ensureSchema();
  const result = await postgres.query(
    "UPDATE price_alerts SET status = 'ACTIVE' WHERE id = $1 AND status = 'DELIVERING'",
    [id]
  );
  return result.rowCount > 0;
}

module.exports = { claimEligible, markTriggered, releaseClaim };
