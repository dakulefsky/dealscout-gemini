const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/categories?slug=electronics
router.get('/', (req, res) => {
  const { slug } = req.query;
  if (slug) {
    const row = db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug);
    return res.json(row ? [row] : []);
  }
  const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json(rows);
});

// GET /api/categories/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Category not found' });
  res.json(row);
});

// POST /api/categories  (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { name, slug, description } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
  const id = uuidv4();
  db.prepare('INSERT INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)').run(id, name, slug, description ?? null);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
});

// PATCH /api/categories/:id  (admin only)
router.patch('/:id', requireAdmin, (req, res) => {
  const { name, slug, description } = req.body;
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Category not found' });
  db.prepare('UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?').run(
    name ?? row.name, slug ?? row.slug, description ?? row.description, req.params.id
  );
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

// DELETE /api/categories/:id  (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
