const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

function rowToDeal(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    asin: r.asin,
    category: r.category,
    originalPrice: r.original_price,
    salePrice: r.sale_price,
    discountPercent: r.discount_percent,
    imageUrl: r.image_url,
    productUrl: r.product_url,
    rating: r.rating,
    ratingsTotal: r.ratings_total,
    shortBio: r.short_bio,
    fullSummary: r.full_summary,
    pros: r.pros,
    cons: r.cons,
    reviews: r.reviews,
    sourceSufficient: r.source_sufficient === 1,
    status: r.status,
    rawSourceData: r.raw_source_data,
    created_date: new Date(r.created_at * 1000).toISOString(),
  };
}

// GET /api/deals?status=APPROVED&limit=50&sort=-created_date
router.get('/', (req, res) => {
  const { status, category, limit = 50, sort = '-created_date' } = req.query;

  let where = [];
  let params = [];

  if (status) { where.push('status = ?'); params.push(status); }
  if (category) { where.push('category = ?'); params.push(category); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const orderBy = sort === '-created_date' ? 'created_at DESC' : 'created_at ASC';

  const rows = db.prepare(
    `SELECT * FROM deals ${whereClause} ORDER BY ${orderBy} LIMIT ?`
  ).all(...params, Number(limit));

  res.json(rows.map(rowToDeal));
});

// GET /api/deals/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Deal not found' });
  res.json(rowToDeal(row));
});

// POST /api/deals  (admin only)
router.post('/', requireAdmin, (req, res) => {
  const b = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO deals (
      id, title, asin, category, original_price, sale_price, discount_percent,
      image_url, product_url, rating, ratings_total, short_bio, full_summary,
      pros, cons, reviews, source_sufficient, status, raw_source_data
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, b.title, b.asin, b.category ?? null,
    b.originalPrice ?? 0, b.salePrice ?? 0, b.discountPercent ?? 0,
    b.imageUrl ?? null, b.productUrl,
    b.rating ?? null, b.ratingsTotal ?? null,
    b.shortBio ?? null, b.fullSummary ?? null,
    b.pros ?? null, b.cons ?? null, b.reviews ?? null,
    b.sourceSufficient !== false ? 1 : 0,
    b.status ?? 'PENDING_REVIEW',
    b.rawSourceData ?? null
  );
  const row = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
  res.status(201).json(rowToDeal(row));
});

// PATCH /api/deals/:id  (admin only)
router.patch('/:id', requireAdmin, (req, res) => {
  const b = req.body;
  const row = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Deal not found' });

  const fields = {
    title: b.title,
    asin: b.asin,
    category: b.category,
    original_price: b.originalPrice,
    sale_price: b.salePrice,
    discount_percent: b.discountPercent,
    image_url: b.imageUrl,
    product_url: b.productUrl,
    rating: b.rating,
    ratings_total: b.ratingsTotal,
    short_bio: b.shortBio,
    full_summary: b.fullSummary,
    pros: b.pros,
    cons: b.cons,
    reviews: b.reviews,
    source_sufficient: b.sourceSufficient !== undefined ? (b.sourceSufficient ? 1 : 0) : undefined,
    status: b.status,
    raw_source_data: b.rawSourceData,
  };

  const updates = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => `${k} = ?`);
  const values = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([, v]) => v);

  if (updates.length) {
    db.prepare(`UPDATE deals SET ${updates.join(', ')} WHERE id = ?`).run(...values, req.params.id);
  }

  res.json(rowToDeal(db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id)));
});

// DELETE /api/deals/:id  (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
