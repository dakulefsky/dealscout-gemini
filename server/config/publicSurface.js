function clean(value) {
  return String(value ?? '').trim();
}

function normalizeOrigin(value, { requireHttps = false } = {}) {
  const raw = clean(value);
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid absolute URL: ${raw}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol for origin: ${parsed.protocol}`);
  }
  if (requireHttps && parsed.protocol !== 'https:') {
    throw new Error(`Production public origins must use https: ${raw}`);
  }
  return parsed.origin;
}

function resolvePublicWebUrl(env = process.env, { isProduction = env.NODE_ENV === 'production' } = {}) {
  const candidate = clean(env.PUBLIC_WEB_URL) || clean(env.FRONTEND_URL);
  return candidate ? normalizeOrigin(candidate, { requireHttps: isProduction }) : null;
}

function resolveCorsOrigins(env = process.env, { isProduction = env.NODE_ENV === 'production' } = {}) {
  const configured = clean(env.CORS_ORIGINS);
  const fallback = resolvePublicWebUrl(env, { isProduction });
  const values = configured
    ? configured.split(',').map((value) => value.trim()).filter(Boolean)
    : (fallback ? [fallback] : []);
  return [...new Set(values.map((value) => normalizeOrigin(value, { requireHttps: isProduction })))];
}

function createCorsOriginPolicy(allowedOrigins = [], { isProduction = process.env.NODE_ENV === 'production' } = {}) {
  const allowed = new Set(allowedOrigins);
  if (!isProduction) return true;
  return (origin, callback) => {
    // Native apps, server-to-server workers, health checks and CLIs usually do
    // not send an Origin header. CORS is a browser boundary, not an API auth layer.
    if (!origin) return callback(null, true);
    let normalized;
    try {
      normalized = normalizeOrigin(origin, { requireHttps: true });
    } catch {
      return callback(null, false);
    }
    return callback(null, allowed.has(normalized));
  };
}

module.exports = {
  normalizeOrigin,
  resolvePublicWebUrl,
  resolveCorsOrigins,
  createCorsOriginPolicy,
};
