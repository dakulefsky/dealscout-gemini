const postgres = require('../storage/postgres');

let schemaReady = false;
const memory = new Map();

function nowUnix() { return Math.floor(Date.now() / 1000); }

function normalizeEditorialInput(input = {}) {
  const asin = String(input.asin || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error('Valid ASIN is required');

  const note = String(input.editorialNote || input.editorial_note || '').trim();
  if (note.length > 600) throw new Error('Editorial note must be 600 characters or fewer');

  return {
    asin,
    editorial_note: note,
    is_human_pick: input.isHumanPick === true || input.is_human_pick === true,
    reviewed_by: String(input.reviewedBy || input.reviewed_by || '').trim().slice(0, 200) || null,
    reviewed_at: Number(input.reviewedAt || input.reviewed_at || nowUnix()),
    updated_at: nowUnix(),
  };
}

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaReady) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS deal_editorial (
      asin VARCHAR(10) PRIMARY KEY,
      editorial_note TEXT NOT NULL DEFAULT '',
      is_human_pick BOOLEAN NOT NULL DEFAULT FALSE,
      reviewed_by TEXT,
      reviewed_at BIGINT,
      updated_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_deal_editorial_human_pick ON deal_editorial (is_human_pick, reviewed_at DESC);
  `);
  schemaReady = true;
}

async function getByAsin(asin) {
  const key = String(asin || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(key)) return null;
  if (!postgres.isConfigured()) return memory.get(key) || null;
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM deal_editorial WHERE asin = $1 LIMIT 1', [key]);
  return result.rows[0] || null;
}

async function upsert(input) {
  const row = normalizeEditorialInput(input);
  if (!postgres.isConfigured()) {
    memory.set(row.asin, row);
    return row;
  }
  await ensureSchema();
  const result = await postgres.query(`
    INSERT INTO deal_editorial (asin, editorial_note, is_human_pick, reviewed_by, reviewed_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (asin) DO UPDATE SET
      editorial_note = EXCLUDED.editorial_note,
      is_human_pick = EXCLUDED.is_human_pick,
      reviewed_by = EXCLUDED.reviewed_by,
      reviewed_at = EXCLUDED.reviewed_at,
      updated_at = EXCLUDED.updated_at
    RETURNING *`,
    [row.asin, row.editorial_note, row.is_human_pick, row.reviewed_by, row.reviewed_at, row.updated_at]
  );
  return result.rows[0];
}

async function remove(asin) {
  const key = String(asin || '').trim().toUpperCase();
  if (!postgres.isConfigured()) return memory.delete(key);
  await ensureSchema();
  const result = await postgres.query('DELETE FROM deal_editorial WHERE asin = $1', [key]);
  return result.rowCount > 0;
}

module.exports = { ensureSchema, getByAsin, upsert, remove, normalizeEditorialInput };
