const postgres = require('../storage/postgres');

const BUDGET_LOCK_ID = 44005;
const localUsage = new Map();
let schemaEnsured = false;

class ProviderBudgetExceededError extends Error {
  constructor(provider, scope, limit) {
    super(`${provider} request budget reached for ${scope}`);
    this.name = 'ProviderBudgetExceededError';
    this.code = 'PROVIDER_BUDGET_EXCEEDED';
    this.provider = provider;
    this.scope = scope;
    this.limit = limit;
    this.statusCode = 429;
  }
}

function cleanProvider(provider) {
  return String(provider || '').trim().toLowerCase() || 'unknown';
}

function positiveLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function limitsFor(provider) {
  const key = cleanProvider(provider);
  if (key === 'rainforest') {
    return {
      daily: positiveLimit(process.env.RAINFOREST_DAILY_REQUEST_LIMIT, 16),
      monthly: positiveLimit(process.env.RAINFOREST_MONTHLY_REQUEST_LIMIT, 500),
    };
  }
  if (key === 'gemini') {
    return {
      daily: positiveLimit(process.env.GEMINI_DAILY_REQUEST_LIMIT, 200),
      monthly: positiveLimit(process.env.GEMINI_MONTHLY_REQUEST_LIMIT, 5000),
    };
  }
  return { daily: Infinity, monthly: Infinity };
}

function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
function monthKey(date = new Date()) { return date.toISOString().slice(0, 7); }
function remaining(limit, used) { return Number.isFinite(limit) ? Math.max(0, limit - used) : null; }

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaEnsured) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS provider_request_usage (
      provider TEXT NOT NULL,
      usage_date DATE NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      blocked_count INTEGER NOT NULL DEFAULT 0,
      last_request_at TIMESTAMPTZ,
      last_blocked_at TIMESTAMPTZ,
      PRIMARY KEY (provider, usage_date)
    )
  `);
  await postgres.query('CREATE INDEX IF NOT EXISTS idx_provider_request_usage_month ON provider_request_usage(provider, usage_date)');
  schemaEnsured = true;
}

function localStatus(provider, now = new Date()) {
  const key = cleanProvider(provider);
  const today = dayKey(now);
  const month = monthKey(now);
  let dayCount = 0;
  let monthCount = 0;
  let blockedToday = 0;
  let lastRequestAt = null;
  let lastBlockedAt = null;

  for (const [entryKey, entry] of localUsage.entries()) {
    const [entryProvider, entryDay] = entryKey.split('|');
    if (entryProvider !== key) continue;
    if (entryDay.startsWith(month)) monthCount += entry.requestCount || 0;
    if (entryDay === today) {
      dayCount = entry.requestCount || 0;
      blockedToday = entry.blockedCount || 0;
      lastRequestAt = entry.lastRequestAt || null;
      lastBlockedAt = entry.lastBlockedAt || null;
    }
  }

  return { dayCount, monthCount, blockedToday, lastRequestAt, lastBlockedAt };
}

function emptyStatus(provider) {
  return {
    provider: cleanProvider(provider),
    limits: { daily: null, monthly: null },
    dayCount: 0,
    monthCount: 0,
    blockedToday: 0,
    lastRequestAt: null,
    lastBlockedAt: null,
    remainingToday: null,
    remainingMonth: null,
  };
}

async function usageStatus(provider, now = new Date()) {
  const key = cleanProvider(provider);
  const limits = limitsFor(key);
  if (!Number.isFinite(limits.daily) && !Number.isFinite(limits.monthly)) return emptyStatus(key);

  let usage;
  if (!postgres.isConfigured()) {
    usage = localStatus(key, now);
  } else {
    await ensureSchema();
    const today = dayKey(now);
    const monthStart = `${monthKey(now)}-01`;
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    const result = await postgres.query(`
      SELECT
        COALESCE(SUM(CASE WHEN usage_date = $2::date THEN request_count ELSE 0 END), 0)::int AS day_count,
        COALESCE(SUM(request_count), 0)::int AS month_count,
        COALESCE(SUM(CASE WHEN usage_date = $2::date THEN blocked_count ELSE 0 END), 0)::int AS blocked_today,
        MAX(CASE WHEN usage_date = $2::date THEN last_request_at END) AS last_request_at,
        MAX(CASE WHEN usage_date = $2::date THEN last_blocked_at END) AS last_blocked_at
      FROM provider_request_usage
      WHERE provider = $1 AND usage_date >= $3::date AND usage_date < $4::date
    `, [key, today, monthStart, nextMonth]);
    const row = result.rows[0] || {};
    usage = {
      dayCount: Number(row.day_count || 0),
      monthCount: Number(row.month_count || 0),
      blockedToday: Number(row.blocked_today || 0),
      lastRequestAt: row.last_request_at || null,
      lastBlockedAt: row.last_blocked_at || null,
    };
  }

  return {
    provider: key,
    limits,
    ...usage,
    remainingToday: remaining(limits.daily, usage.dayCount),
    remainingMonth: remaining(limits.monthly, usage.monthCount),
  };
}

async function recordBlockedPostgres(client, provider, today) {
  await client.query(`
    INSERT INTO provider_request_usage(provider, usage_date, blocked_count, last_blocked_at)
    VALUES ($1, $2::date, 1, NOW())
    ON CONFLICT (provider, usage_date)
    DO UPDATE SET blocked_count = provider_request_usage.blocked_count + 1, last_blocked_at = NOW()
  `, [provider, today]);
}

async function reserveRequest(provider, now = new Date()) {
  const key = cleanProvider(provider);
  const limits = limitsFor(key);
  if (!Number.isFinite(limits.daily) && !Number.isFinite(limits.monthly)) return emptyStatus(key);

  const today = dayKey(now);
  const month = monthKey(now);

  if (!postgres.isConfigured()) {
    const status = localStatus(key, now);
    if (status.dayCount >= limits.daily || status.monthCount >= limits.monthly) {
      const scope = status.dayCount >= limits.daily ? 'day' : 'month';
      const limit = scope === 'day' ? limits.daily : limits.monthly;
      const entryKey = `${key}|${today}`;
      const entry = localUsage.get(entryKey) || { requestCount: 0, blockedCount: 0 };
      entry.blockedCount += 1;
      entry.lastBlockedAt = now.toISOString();
      localUsage.set(entryKey, entry);
      throw new ProviderBudgetExceededError(key, scope, limit);
    }

    const entryKey = `${key}|${today}`;
    const entry = localUsage.get(entryKey) || { requestCount: 0, blockedCount: 0 };
    entry.requestCount += 1;
    entry.lastRequestAt = now.toISOString();
    localUsage.set(entryKey, entry);
    return usageStatus(key, now);
  }

  await ensureSchema();
  const client = await postgres.getPool().connect();
  let budgetError = null;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [BUDGET_LOCK_ID]);
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    const monthStart = `${month}-01`;
    const counts = await client.query(`
      SELECT
        COALESCE(SUM(CASE WHEN usage_date = $2::date THEN request_count ELSE 0 END), 0)::int AS day_count,
        COALESCE(SUM(request_count), 0)::int AS month_count
      FROM provider_request_usage
      WHERE provider = $1 AND usage_date >= $3::date AND usage_date < $4::date
    `, [key, today, monthStart, nextMonth]);
    const dayCount = Number(counts.rows[0]?.day_count || 0);
    const monthCount = Number(counts.rows[0]?.month_count || 0);

    if (dayCount >= limits.daily || monthCount >= limits.monthly) {
      const scope = dayCount >= limits.daily ? 'day' : 'month';
      const limit = scope === 'day' ? limits.daily : limits.monthly;
      await recordBlockedPostgres(client, key, today);
      budgetError = new ProviderBudgetExceededError(key, scope, limit);
    } else {
      await client.query(`
        INSERT INTO provider_request_usage(provider, usage_date, request_count, last_request_at)
        VALUES ($1, $2::date, 1, NOW())
        ON CONFLICT (provider, usage_date)
        DO UPDATE SET request_count = provider_request_usage.request_count + 1, last_request_at = NOW()
      `, [key, today]);
    }

    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }

  if (budgetError) throw budgetError;
  return usageStatus(key, now);
}

function resetLocalUsage() {
  localUsage.clear();
}

module.exports = {
  ProviderBudgetExceededError,
  limitsFor,
  ensureSchema,
  usageStatus,
  reserveRequest,
  resetLocalUsage,
};
