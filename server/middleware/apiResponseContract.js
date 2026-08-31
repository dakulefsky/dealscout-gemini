const crypto = require('crypto');

const ERROR_CODES = Object.freeze({
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
});

function errorCodeForStatus(status) {
  return ERROR_CODES[Number(status)] || (Number(status) >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED');
}

function apiResponseContract(req, res, next) {
  const path = String(req.path || '');
  if (!path.startsWith('/api/')) return next();

  const requestId = crypto.randomUUID();
  res.locals = res.locals || {};
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const isV1 = path === '/api/v1' || path.startsWith('/api/v1/');
  if (isV1) {
    // Apply before global rate limiting so even early 4xx/429 responses retain
    // the mobile compatibility contract and can be correlated in logs.
    res.setHeader('X-DealScout-API-Version', '1');
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      if (res.statusCode >= 400 && payload && typeof payload === 'object' && !Array.isArray(payload) && payload.error) {
        return originalJson({
          ...payload,
          code: payload.code || errorCodeForStatus(res.statusCode),
          requestId: payload.requestId || requestId,
        });
      }
      return originalJson(payload);
    };
  }

  next();
}

module.exports = { apiResponseContract, errorCodeForStatus, ERROR_CODES };
