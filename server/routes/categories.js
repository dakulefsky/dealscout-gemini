const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../middleware/auth');
const categories = require('../repositories/categoryRepository');

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

router.get('/', async (req, res) => {
  try {
    res.json(await categories.list({
      slug: req.query.slug,
      activeOnly: req.query.activeOnly === '1' || req.query.activeOnly === 'true',
    }));
  } catch (err) {
    console.error('[categories] list failed:', err.message);
    res.status(503).json({ error: 'Categories are temporarily unavailable' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await categories.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Category not found' });
    res.json(row);
  } catch (err) {
    console.error('[categories] lookup failed:', err.message);
    res.status(503).json({ error: 'Categories are temporarily unavailable' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const slug = normalizeSlug(req.body?.slug || name);
    const description = req.body?.description ?? null;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
    const existing = await categories.list({ slug });
    if (existing.length) return res.status(409).json({ error: 'Category slug already exists' });
    res.status(201).json(await categories.create({ id: uuidv4(), name, slug, description }));
  } catch (err) {
    console.error('[categories] create failed:', err.message);
    res.status(503).json({ error: 'Unable to create category' });
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const changes = {};
    if (req.body?.name !== undefined) changes.name = String(req.body.name).trim();
    if (req.body?.slug !== undefined) changes.slug = normalizeSlug(req.body.slug);
    if (req.body?.description !== undefined) changes.description = req.body.description;
    if (changes.name === '' || changes.slug === '') return res.status(400).json({ error: 'name and slug cannot be empty' });
    if (changes.slug) {
      const matches = await categories.list({ slug: changes.slug });
      if (matches.some((row) => row.id !== req.params.id)) return res.status(409).json({ error: 'Category slug already exists' });
    }
    const updated = await categories.update(req.params.id, changes);
    if (!updated) return res.status(404).json({ error: 'Category not found' });
    res.json(updated);
  } catch (err) {
    console.error('[categories] update failed:', err.message);
    res.status(503).json({ error: 'Unable to update category' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const removed = await categories.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Category not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[categories] delete failed:', err.message);
    res.status(503).json({ error: 'Unable to delete category' });
  }
});

module.exports = router;
