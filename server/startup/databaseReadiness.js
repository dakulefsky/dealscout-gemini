const RETRYABLE_CODES = new Set([
  'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH',
  'EAI_AGAIN', 'ENOTFOUND', '57P03', '53300',
]);

function retryable(result) {
  if (result.code) return RETRYABLE_CODES.has(result.code);
  return /connection timeout|timeout exceeded when trying to connect|connect ETIMEDOUT|connection terminated unexpectedly/i.test(result.error || '');
}

async function waitForDatabase({ health, maxAttempts = 8, maxWaitMs = 90000,
  retryDelayMs = 3000, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  warn = (message) => console.warn(message) }) {
  const startedAt = now();
  let result;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    result = await health();
    if (result.healthy) return result;
    // Authentication, certificate and malformed configuration errors need a fix,
    // not a repeated connection attempt. Only transient connectivity is retried.
    if (!retryable(result) || attempt === maxAttempts || now() - startedAt + retryDelayMs >= maxWaitMs) break;
    warn(`[DealScout] Startup database network not ready (${attempt}/${maxAttempts}); retrying`);
    await sleep(retryDelayMs);
  }
  const detail = result?.error ? `: ${result.error}` : '';
  throw new Error(`PostgreSQL readiness check failed during production startup${detail}`);
}

module.exports = { waitForDatabase, retryable };
