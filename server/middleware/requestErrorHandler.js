function requestErrorHandler(err, _req, res, next) {
  if (res.headersSent) return next(err);
  const requestedStatus = Number(err?.status || err?.statusCode);
  const status = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus < 500 ? requestedStatus : 500;
  if (status < 500) {
    // Parser errors carry the submitted body, and their messages can quote it.
    // Login/reset credentials must never be copied into application logs.
    console.warn(`[DealScout] Request rejected: HTTP ${status}`);
  } else {
    console.error('[DealScout] Unhandled request error:', err?.message || 'Unknown error');
  }
  const message = status === 413 ? 'Request body is too large'
    : status < 500 ? 'Invalid request' : 'Internal server error';
  return res.status(status).json({ error: message });
}

module.exports = { requestErrorHandler };
