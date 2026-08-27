const db = require('../db');
const postgres = require('../storage/postgres');
const deals = require('./dealRepository');
const { v4: uuidv4 } = require('uuid');

let schemaReady = false;
function nowUnix() { return Math.floor(Date.now() / 1000); }

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaReady) return;
  await deals.ensureSchema();
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      target_price NUMERIC(12,2),
      created_at BIGINT NOT NULL,
      UNIQUE (user_id, deal_id)
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS price_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      deal_title TEXT NOT NULL,
      current_price NUMERIC(12,2) NOT NULL,
      target_price NUMERIC(12,2) NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at BIGINT NOT NULL,
      UNIQUE (user_id, deal_id)
    );
    CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts (status, deal_id);
  `);

  const bookmarkCount = await postgres.query('SELECT COUNT(*)::int AS count FROM bookmarks');
  if (bookmarkCount.rows[0].count === 0) {
    for (const bookmark of db.tables.bookmarks || []) {
      const deal = await deals.findByIdOrAsin(bookmark.dealId);
      if (!deal) continue;
      await postgres.query(
        `INSERT INTO bookmarks (id, user_id, deal_id, target_price, created_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, deal_id) DO NOTHING`,
        [bookmark.id || uuidv4(), bookmark.userId, deal.id, bookmark.targetPrice ?? null, bookmark.createdAt || nowUnix()]
      );
    }
  }

  const alertCount = await postgres.query('SELECT COUNT(*)::int AS count FROM price_alerts');
  if (alertCount.rows[0].count === 0) {
    for (const alert of db.tables.price_alerts || []) {
      const deal = await deals.findByIdOrAsin(alert.dealId);
      const targetPrice = Number(alert.targetPrice);
      const currentPrice = Number(alert.currentPrice ?? deal?.sale_price);
      if (!deal || !Number.isFinite(targetPrice) || targetPrice <= 0 || !Number.isFinite(currentPrice) || currentPrice <= 0 || !alert.email) continue;
      await postgres.query(
        `INSERT INTO price_alerts (id, user_id, deal_id, deal_title, current_price, target_price, email, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (user_id, deal_id) DO NOTHING`,
        [alert.id || uuidv4(), alert.userId, deal.id, alert.dealTitle || deal.title, currentPrice, targetPrice, alert.email, alert.status || 'ACTIVE', alert.createdAt || nowUnix()]
      );
    }
  }
  schemaReady = true;
}

function mapBookmark(row) {
  return row ? { id: row.id, userId: row.user_id, dealId: row.deal_id, targetPrice: row.target_price == null ? null : Number(row.target_price), createdAt: Number(row.created_at) } : null;
}
function mapAlert(row) {
  return row ? { id: row.id, userId: row.user_id, dealId: row.deal_id, dealTitle: row.deal_title, currentPrice: Number(row.current_price), targetPrice: Number(row.target_price), email: row.email, status: row.status, createdAt: Number(row.created_at) } : null;
}

async function listBookmarks(userId) {
  if (!postgres.isConfigured()) return (db.tables.bookmarks || []).filter((b) => b.userId === userId).map((b) => ({ ...b }));
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM bookmarks WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows.map(mapBookmark);
}

async function getBookmark(userId, dealId) {
  if (!postgres.isConfigured()) {
    const row = (db.tables.bookmarks || []).find((b) => b.userId === userId && b.dealId === dealId);
    return row ? { ...row } : null;
  }
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM bookmarks WHERE user_id = $1 AND deal_id = $2 LIMIT 1', [userId, dealId]);
  return mapBookmark(result.rows[0]);
}

async function toggleBookmark(userId, dealId, targetPrice = null) {
  const existing = await getBookmark(userId, dealId);
  if (existing) {
    if (!postgres.isConfigured()) {
      db.tables.bookmarks = db.tables.bookmarks.filter((b) => !(b.userId === userId && b.dealId === dealId));
      db.saveDb();
    } else {
      await postgres.query('DELETE FROM bookmarks WHERE user_id = $1 AND deal_id = $2', [userId, dealId]);
    }
    return { isSaved: false, bookmark: null };
  }

  const bookmark = { id: uuidv4(), userId, dealId, targetPrice, createdAt: nowUnix() };
  if (!postgres.isConfigured()) {
    db.tables.bookmarks.push(bookmark); db.saveDb();
    return { isSaved: true, bookmark };
  }
  await ensureSchema();
  const result = await postgres.query(
    `INSERT INTO bookmarks (id, user_id, deal_id, target_price, created_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [bookmark.id, userId, dealId, targetPrice, bookmark.createdAt]
  );
  return { isSaved: true, bookmark: mapBookmark(result.rows[0]) };
}

async function setBookmarkTarget(userId, dealId, targetPrice) {
  const existing = await getBookmark(userId, dealId);
  if (!existing) {
    if (!postgres.isConfigured()) {
      const bookmark = { id: uuidv4(), userId, dealId, targetPrice, createdAt: nowUnix() };
      db.tables.bookmarks.push(bookmark); db.saveDb(); return bookmark;
    }
    await ensureSchema();
    const result = await postgres.query(
      `INSERT INTO bookmarks (id, user_id, deal_id, target_price, created_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [uuidv4(), userId, dealId, targetPrice, nowUnix()]
    );
    return mapBookmark(result.rows[0]);
  }
  if (!postgres.isConfigured()) {
    const row = db.tables.bookmarks.find((b) => b.userId === userId && b.dealId === dealId);
    row.targetPrice = targetPrice; db.saveDb(); return { ...row };
  }
  const result = await postgres.query(
    'UPDATE bookmarks SET target_price = $1 WHERE user_id = $2 AND deal_id = $3 RETURNING *',
    [targetPrice, userId, dealId]
  );
  return mapBookmark(result.rows[0]);
}

async function upsertAlert({ userId, deal, targetPrice, email }) {
  const record = {
    id: uuidv4(), userId, dealId: deal.id, dealTitle: deal.title,
    currentPrice: Number(deal.sale_price), targetPrice: Number(targetPrice),
    email, status: 'ACTIVE', createdAt: nowUnix(),
  };
  if (!postgres.isConfigured()) {
    const index = db.tables.price_alerts.findIndex((a) => a.userId === userId && a.dealId === deal.id);
    if (index >= 0) record.id = db.tables.price_alerts[index].id;
    if (index >= 0) record.createdAt = db.tables.price_alerts[index].createdAt;
    if (index >= 0) db.tables.price_alerts[index] = record;
    else db.tables.price_alerts.push(record);
    db.saveDb();
    return { ...record };
  }
  await ensureSchema();
  const result = await postgres.query(`
    INSERT INTO price_alerts (id, user_id, deal_id, deal_title, current_price, target_price, email, status, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (user_id, deal_id) DO UPDATE SET
      deal_title=EXCLUDED.deal_title, current_price=EXCLUDED.current_price,
      target_price=EXCLUDED.target_price, email=EXCLUDED.email, status='ACTIVE'
    RETURNING *`,
    [record.id, userId, deal.id, deal.title, record.currentPrice, record.targetPrice, email, 'ACTIVE', record.createdAt]
  );
  return mapAlert(result.rows[0]);
}

async function countBookmarks(userId) {
  if (!postgres.isConfigured()) return (db.tables.bookmarks || []).filter((b) => b.userId === userId).length;
  await ensureSchema();
  const result = await postgres.query('SELECT COUNT(*)::int AS count FROM bookmarks WHERE user_id = $1', [userId]);
  return result.rows[0].count;
}

module.exports = { ensureSchema, listBookmarks, getBookmark, toggleBookmark, setBookmarkTarget, upsertAlert, countBookmarks };
