const test = require('node:test');
const assert = require('node:assert/strict');
const { inferAction, inferTarget } = require('../server/middleware/adminActivityAudit');
const { normalize } = require('../server/repositories/activityRepository');

test('admin activity audit classifies important operations without request body logging', () => {
  assert.equal(inferAction({ method: 'POST', originalUrl: '/api/functions/repair-images' }), 'images.repair');
  assert.equal(inferAction({ method: 'POST', originalUrl: '/api/functions/legacy-enrichment-cleanup' }), 'legacy_enrichment.cleanup');
  assert.equal(inferAction({ method: 'POST', originalUrl: '/api/deals/abc/expire' }), 'deal.expire');
  assert.equal(inferAction({ method: 'PUT', originalUrl: '/api/editorial/B0GGGQDY9H' }), 'editorial.save');
});

test('admin activity audit extracts safe target identifiers', () => {
  assert.deepEqual(inferTarget({ originalUrl: '/api/deals/deal_123', body: {} }), { type: 'deal', id: 'deal_123' });
  assert.deepEqual(inferTarget({ originalUrl: '/api/editorial/B0GGGQDY9H', body: {} }), { type: 'editorial', id: 'B0GGGQDY9H' });
  assert.deepEqual(inferTarget({ originalUrl: '/api/functions/repair-images', body: {} }), { type: 'operation', id: 'repair-images' });
});

test('activity rows only contain the explicit safe audit fields', () => {
  const row = normalize({ action: 'deal.patch', targetType: 'deal', targetId: 'x', actor: 'admin@example.com', method: 'PATCH', path: '/api/deals/x', secret: 'do-not-store' });
  assert.equal(row.action, 'deal.patch');
  assert.equal(row.target_id, 'x');
  assert.equal(row.secret, undefined);
  assert.deepEqual(Object.keys(row).sort(), ['action', 'actor', 'created_at', 'id', 'method', 'path', 'target_id', 'target_type'].sort());
});
