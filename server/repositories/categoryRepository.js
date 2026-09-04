const db = require('../db');
const postgres = require('../storage/postgres');
const { isPublicDeal, freshPriceThreshold } = require('../services/publicDealPolicy');

let schemaReady = false;

const CANONICAL_CATEGORIES = [
  ['cat-electronics', 'Electronics', 'electronics', 'Tech, audio, computers, TVs, gaming, and smart devices.'],
  ['cat-home-kitchen', 'Home & Kitchen', 'home-kitchen', 'Cookware, appliances, furniture, cleaning, and home essentials.'],
  ['cat-sports-outdoors', 'Sports & Outdoors', 'sports-outdoors', 'Fitness, camping, cycling, and outdoor equipment.'],
  ['cat-health-beauty', 'Health & Beauty', 'health-beauty', 'Personal care, grooming, skincare, haircare, and wellness.'],
  ['cat-toys-games', 'Toys & Games', 'toys-games', 'Toys, games, puzzles, and hobby products.'],
  ['cat-baby', 'Baby', 'baby', 'Baby and toddler essentials.'],
  ['cat-pet-supplies', 'Pet Supplies', 'pet-supplies', 'Food, gear, and essentials for pets.'],
  ['cat-automotive', 'Automotive', 'automotive', 'Car, truck, and vehicle accessories.'],
  ['cat-tools-home-improvement', 'Tools & Home Improvement', 'tools-home-improvement', 'Tools, hardware, and home-improvement products.'],
  ['cat-office-school', 'Office & School', 'office-school', 'Office, school, stationery, and workspace essentials.'],
  ['cat-clothing-accessories', 'Clothing & Accessories', 'clothing-accessories', 'Apparel, shoes, watches, jewelry, and accessories.'],
  ['cat-grocery', 'Grocery', 'grocery', 'Food, beverages, snacks, and pantry items.'],
  ['cat-other', 'Other', 'other', 'Deals that do not cleanly fit another category.'],
].map(([id, name, slug, description]) => ({ id, name, slug, description }));

async function ensureSchema() {
  if (!postgres.isConfigured() || schemaReady) return;
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at BIGINT NOT NULL
    )
  `);

  const createdAt = Math.floor(Date.now() / 1000);
  for (const category of CANONICAL_CATEGORIES) {
    await postgres.query(
      `INSERT INTO categories (id, name, slug, description, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         description = EXCLUDED.description`,
      [category.id, category.name, category.slug, category.description, createdAt]
    );
  }

  await postgres.query("DELETE FROM categories WHERE id = 'cat-amazon-devices' OR slug = 'amazon-devices'");
  schemaReady = true;
}

function localCategories() {
  const createdAt = Math.floor(Date.now() / 1000);
  return CANONICAL_CATEGORIES.map((category) => ({ ...category, created_at: createdAt }));
}

function sortWithInventory(rows, activeOnly) {
  return rows.sort((a, b) => {
    if (activeOnly) {
      const countDiff = Number(b.liveCount || 0) - Number(a.liveCount || 0);
      if (countDiff) return countDiff;
    }
    return String(a.name).localeCompare(String(b.name));
  });
}

async function list({ slug, activeOnly = false } = {}) {
  if (!postgres.isConfigured()) {
    const counts = new Map();
    for (const deal of db.tables.deals || []) {
      if (!isPublicDeal(deal)) continue;
      const key = String(deal.category || '').trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    let rows = localCategories().map((category) => ({
      ...category,
      liveCount: counts.get(String(category.name).toLowerCase()) || 0,
    }));
    if (slug) rows = rows.filter((c) => c.slug === slug);
    if (activeOnly) rows = rows.filter((c) => c.liveCount > 0);
    return sortWithInventory(rows, activeOnly).map((c) => ({ ...c }));
  }

  await ensureSchema();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const params = [freshPriceThreshold(nowSeconds), nowSeconds];
  const where = [];
  if (slug) where.push(`c.slug = $${params.push(slug)}`);
  const having = activeOnly ? 'HAVING COUNT(d.id) > 0' : '';
  const order = activeOnly ? 'live_count DESC, c.name ASC' : 'c.name ASC';
  const result = await postgres.query(`
    SELECT c.*, COUNT(d.id)::int AS live_count
      FROM categories c
      LEFT JOIN deals d
        ON LOWER(COALESCE(d.category, '')) = LOWER(c.name)
       AND d.status = 'APPROVED'
       AND d.is_expired <> 1
       AND d.source_verified = 1
       AND d.original_price > 0
       AND d.sale_price > 0
       AND d.sale_price < d.original_price
       AND d.price_check_at IS NOT NULL
       AND d.price_check_at >= $1
       AND d.price_check_at <= $2
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY c.id, c.name, c.slug, c.description, c.created_at
     ${having}
     ORDER BY ${order}
  `, params);
  return result.rows.map((row) => {
    const { live_count: liveCount, ...category } = row;
    return { ...category, liveCount: Number(liveCount || 0) };
  });
}

async function getById(id) {
  if (!postgres.isConfigured()) {
    const category = localCategories().find((c) => c.id === id);
    return category ? { ...category } : null;
  }
  await ensureSchema();
  const result = await postgres.query('SELECT * FROM categories WHERE id = $1 LIMIT 1', [id]);
  return result.rows[0] || null;
}

async function create({ id, name, slug, description }) {
  if (!postgres.isConfigured()) {
    const category = { id, name, slug, description: description || null, created_at: Math.floor(Date.now() / 1000) };
    db.tables.categories.push(category);
    db.saveDb();
    return { ...category };
  }
  await ensureSchema();
  const result = await postgres.query(
    `INSERT INTO categories (id, name, slug, description, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, name, slug, description || null, Math.floor(Date.now() / 1000)]
  );
  return result.rows[0];
}

async function update(id, changes) {
  const current = await getById(id);
  if (!current) return null;
  const next = {
    name: changes.name ?? current.name,
    slug: changes.slug ?? current.slug,
    description: changes.description ?? current.description,
  };

  if (!postgres.isConfigured()) {
    const index = db.tables.categories.findIndex((c) => c.id === id);
    if (index === -1) return { ...current, ...next };
    db.tables.categories[index] = { ...db.tables.categories[index], ...next };
    db.saveDb();
    return { ...db.tables.categories[index] };
  }
  const result = await postgres.query(
    `UPDATE categories
        SET name = $1, slug = $2, description = $3
      WHERE id = $4
      RETURNING *`,
    [next.name, next.slug, next.description || null, id]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  if (!postgres.isConfigured()) {
    const index = db.tables.categories.findIndex((c) => c.id === id);
    if (index === -1) return false;
    db.tables.categories.splice(index, 1);
    db.saveDb();
    return true;
  }
  await ensureSchema();
  const result = await postgres.query('DELETE FROM categories WHERE id = $1', [id]);
  return result.rowCount > 0;
}

module.exports = { list, getById, create, update, remove, ensureSchema, CANONICAL_CATEGORIES };
