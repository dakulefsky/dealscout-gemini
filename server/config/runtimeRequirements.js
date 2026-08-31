const { resolvePublicWebUrl, resolveCorsOrigins } = require('./publicSurface');

const RUNTIME_ROLES = Object.freeze({ WEB: 'web', PUBLICATION_WORKER: 'publication_worker' });

function clean(value) {
  return String(value ?? '').trim();
}

function validateProductionRuntime(env = process.env, { postgresConfigured = false, role = RUNTIME_ROLES.WEB } = {}) {
  const errors = [];
  if (!Object.values(RUNTIME_ROLES).includes(role)) errors.push(`Unsupported runtime role: ${role}`);
  if (!postgresConfigured) errors.push('PostgreSQL must be configured for production shared state');

  if (role === RUNTIME_ROLES.WEB) {
    const jwtSecret = String(env.JWT_SECRET || '');
    if (jwtSecret.length < 32) errors.push('JWT_SECRET must be configured with at least 32 characters');
    if (!clean(env.AMAZON_ASSOCIATE_TAG)) errors.push('AMAZON_ASSOCIATE_TAG must be configured');

    try {
      resolvePublicWebUrl(env, { isProduction: true });
    } catch (error) {
      errors.push(`PUBLIC_WEB_URL/FRONTEND_URL is invalid: ${error.message}`);
    }

    try {
      resolveCorsOrigins(env, { isProduction: true });
    } catch (error) {
      errors.push(`CORS_ORIGINS is invalid: ${error.message}`);
    }

    const port = Number(env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be an integer from 1 to 65535');
  }

  return errors;
}

function assertProductionRuntime(env = process.env, options = {}) {
  const errors = validateProductionRuntime(env, options);
  if (errors.length) throw new Error(`Invalid production configuration: ${errors.join('; ')}`);
}

module.exports = { RUNTIME_ROLES, validateProductionRuntime, assertProductionRuntime };
