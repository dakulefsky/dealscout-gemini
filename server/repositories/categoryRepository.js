const db = require('../db');
const postgres = require('../storage/postgres');

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

async function list({ slug } = {}) {
  if (!postgres.isConfigured()) {
    let rows = localCategories();
    if (slug) rows = rows.filter((c) => c.slug === slug);
    return rows.sort((a, b) => String(a.name).localeCompare(String(b.name))).map((c) => ({ ...c }));
  }
  await ensureSchema();
  if (slug) {
    const result = await postgres.query('SELECT * FROM categories WHERE slug = $1 ORDER BY name ASC', [slug]);
    return result.rows;
  }
  const result = await postgres.query('SELECT * FROM categories ORDER BY name ASC');
  return result.rows;
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
