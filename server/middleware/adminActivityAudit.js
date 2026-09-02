const activity = require('../repositories/activityRepository');

const AUDITED_PREFIXES = ['/api/deals', '/api/editorial', '/api/functions', '/api/categories'];

function safeActor(user) {
  return String(user?.email || user?.id || user?.sub || 'admin').slice(0, 200);
}

function inferTarget(req) {
  const path = String(req.originalUrl || req.path || '').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  if (parts[1] === 'deals') return { type: 'deal', id: parts[2] || req.body?.asin || null };
  if (parts[1] === 'editorial') return { type: 'editorial', id: parts[2] || req.body?.asin || null };
  if (parts[1] === 'categories') return { type: 'category', id: parts[2] || req.body?.id || req.body?.name || null };
  if (parts[1] === 'functions') return { type: 'operation', id: parts[2] || null };
  return { type: null, id: null };
}

function inferAction(req) {
  const path = String(req.originalUrl || req.path || '').split('?')[0];
  const method = req.method.toUpperCase();
  if (/\/expire$/.test(path)) return 'deal.expire';
  if (/\/restore$/.test(path)) return 'deal.restore';
  if (/\/bulk-status$/.test(path)) return 'deal.bulk_status';
  if (/\/approve-all$/.test(path)) return 'deal.approve_all';
  if (/\/repair-images$/.test(path)) return 'images.repair';
  if (/\/legacy-enrichment-cleanup$/.test(path)) return 'legacy_enrichment.cleanup';
  if (/\/verify-prices$/.test(path)) return 'prices.verify';
  if (/\/fetch-deals$/.test(path)) return 'deals.discover';
  if (/\/provider-switch$/.test(path)) return 'provider.switch';
  if (/\/channel-settings$/.test(path) && method === 'POST') return 'channel.whatsapp_status';
  if (/\/sitestripe-import$/.test(path)) return 'deal.import';
  if (path.startsWith('/api/editorial/')) return method === 'DELETE' ? 'editorial.remove' : 'editorial.save';
  if (path.startsWith('/api/categories')) return `category.${method.toLowerCase()}`;
  if (path.startsWith('/api/deals')) return `deal.${method.toLowerCase()}`;
  return `admin.${method.toLowerCase()}`;
}

function adminActivityAudit(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const path = String(req.originalUrl || req.path || '').split('?')[0];
  if (!AUDITED_PREFIXES.some((prefix) => path.startsWith(prefix))) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400 || req.user?.role !== 'admin') return;
    const target = inferTarget(req);
    activity.append({
      action: inferAction(req),
      targetType: target.type,
      targetId: target.id,
      actor: safeActor(req.user),
      method: req.method,
      path,
    }).catch((error) => console.warn('[adminActivityAudit] unable to record activity:', error.message));
  });

  next();
}

module.exports = { adminActivityAudit, inferAction, inferTarget };
