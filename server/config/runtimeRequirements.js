function clean(value) {
  return String(value ?? '').trim();
}

function validateProductionRuntime(env = process.env, { postgresConfigured = false } = {}) {
  const errors = [];
  const jwtSecret = String(env.JWT_SECRET || '');
  if (jwtSecret.length < 32) errors.push('JWT_SECRET must be configured with at least 32 characters');
  if (!clean(env.AMAZON_ASSOCIATE_TAG)) errors.push('AMAZON_ASSOCIATE_TAG must be configured');
  if (!postgresConfigured) errors.push('PostgreSQL must be configured for production shared state');

  const frontendUrl = clean(env.FRONTEND_URL);
  if (frontendUrl) {
    try {
      const parsed = new URL(frontendUrl);
      if (parsed.protocol !== 'https:') errors.push('FRONTEND_URL must use https in production');
    } catch {
      errors.push('FRONTEND_URL must be a valid absolute URL');
    }
  }

  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be an integer from 1 to 65535');

  return errors;
}

function assertProductionRuntime(env = process.env, options = {}) {
  const errors = validateProductionRuntime(env, options);
  if (errors.length) throw new Error(`Invalid production configuration: ${errors.join('; ')}`);
}

module.exports = { validateProductionRuntime, assertProductionRuntime };
