const MAX_TRUSTED_PROXY_HOPS = 5;

function resolveTrustProxy(value, { isProduction = false } = {}) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return isProduction ? 1 : false;
  if (['0', 'false', 'off', 'none'].includes(raw)) return false;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`TRUST_PROXY must be a hop count between 0 and ${MAX_TRUSTED_PROXY_HOPS}`);
  }
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0 || hops > MAX_TRUSTED_PROXY_HOPS) {
    throw new Error(`TRUST_PROXY must be a hop count between 0 and ${MAX_TRUSTED_PROXY_HOPS}`);
  }
  return hops === 0 ? false : hops;
}

module.exports = { MAX_TRUSTED_PROXY_HOPS, resolveTrustProxy };
