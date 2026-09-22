function publicSurfaceOnly(req, res, next) {
  if (process.env.PUBLIC_SURFACE_ONLY !== 'true') return next();

  const path = req.path || '';

  // Keep the private admin UI and authentication endpoints off the public service.
  if (path.startsWith('/admin') || path.startsWith('/api/v1/auth') || path.startsWith('/api/auth')) {
    return res.status(404).type('text/plain').send('Not found');
  }

  // Operational/admin function endpoints belong only on the private service.
  if (path.startsWith('/api/functions')) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Public shoppers only read deals/categories. Guest bookmarks and notification
  // registration remain available through their dedicated routes.
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET' && (
    path.startsWith('/api/v1/deals') ||
    path.startsWith('/api/deals') ||
    path.startsWith('/api/v1/categories') ||
    path.startsWith('/api/categories')
  )) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Editorial content can be read publicly, but writes stay private.
  if (path.startsWith('/api/editorial') && !['GET', 'HEAD'].includes(method)) {
    return res.status(404).json({ error: 'Not found' });
  }

  next();
}

module.exports = { publicSurfaceOnly };
