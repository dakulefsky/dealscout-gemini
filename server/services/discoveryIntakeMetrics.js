const settings = require('./siteRuntimeSettingsService');
const KEY = 'deal_discovery_intake';
const COUNTS = ['created', 'updated', 'autoApproved', 'pendingReview', 'editorialHoldback', 'rejected'];

function clean(row) {
  if (!row || !Number.isSafeInteger(row.at) || row.at <= 0) return null;
  return Object.fromEntries([
    ['at', row.at], ['scheduled', row.scheduled === true],
    ...COUNTS.map(key => [key, Number.isSafeInteger(row[key]) && row[key] >= 0 ? row[key] : 0]),
  ]);
}

async function read() {
  try {
    const state = JSON.parse((await settings.get(KEY)).value || '{}');
    const history = (Array.isArray(state.history) ? state.history : []).map(clean).filter(Boolean).slice(-12);
    return { latest: history.at(-1) || null, history };
  } catch { return { latest: null, history: [] }; }
}

// The distributed discovery lock serializes successful intake writes. Reporting
// must never turn a completed provider/intake operation into a failed job.
async function record(counts) {
  try {
    const state = await read();
    const latest = clean({ ...counts, at: Date.now() });
    const history = [...state.history, latest].slice(-12);
    await settings.set(KEY, JSON.stringify({ history }));
  } catch { console.warn('[Discovery intake] Durable metrics unavailable'); }
}

module.exports = { read, record };
