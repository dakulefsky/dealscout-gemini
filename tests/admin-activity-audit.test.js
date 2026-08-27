const { inferAction, inferTarget } = require('../server/middleware/adminActivityAudit');
const { normalize } = require('../server/repositories/activityRepository');

describe('admin activity audit', () => {
  test('classifies important operations without request body logging', () => {
    expect(inferAction({ method: 'POST', originalUrl: '/api/functions/repair-images' })).toBe('images.repair');
    expect(inferAction({ method: 'POST', originalUrl: '/api/functions/legacy-enrichment-cleanup' })).toBe('legacy_enrichment.cleanup');
    expect(inferAction({ method: 'POST', originalUrl: '/api/deals/abc/expire' })).toBe('deal.expire');
    expect(inferAction({ method: 'PUT', originalUrl: '/api/editorial/B0GGGQDY9H' })).toBe('editorial.save');
  });

  test('extracts safe target identifiers', () => {
    expect(inferTarget({ originalUrl: '/api/deals/deal_123', body: {} })).toEqual({ type: 'deal', id: 'deal_123' });
    expect(inferTarget({ originalUrl: '/api/editorial/B0GGGQDY9H', body: {} })).toEqual({ type: 'editorial', id: 'B0GGGQDY9H' });
    expect(inferTarget({ originalUrl: '/api/functions/repair-images', body: {} })).toEqual({ type: 'operation', id: 'repair-images' });
  });

  test('activity rows only contain the explicit safe audit fields', () => {
    const row = normalize({ action: 'deal.patch', targetType: 'deal', targetId: 'x', actor: 'admin@example.com', method: 'PATCH', path: '/api/deals/x', secret: 'do-not-store' });
    expect(row.action).toBe('deal.patch');
    expect(row.target_id).toBe('x');
    expect(row.secret).toBeUndefined();
    expect(Object.keys(row).sort()).toEqual(['action', 'actor', 'created_at', 'id', 'method', 'path', 'target_id', 'target_type'].sort());
  });
});
