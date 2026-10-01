const db = require('../db');
const postgres = require('../storage/postgres');
const { classifyCategory, strongTitleCategory } = require('../services/categoryClassifier');
const { isPublicDeal, freshPriceThreshold, PUBLIC_MIN_DISCOUNT_PERCENT } = require('../services/publicDealPolicy');

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
  const canonical = CANONICAL_CATEGORIES.map((category) => ({ ...category, created_at: createdAt }));
  const slugs = new Set(canonical.map((category) => category.slug));
  return [...canonical, ...(db.tables.categories || []).filter((category) =>
    category.slug !== 'amazon-devices' && !slugs.has(category.slug))];
}

function categorySlug(name) {
  return String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

async function ensureForDeal(name) {
  const cleaned = String(name || '').trim();
  const slug = categorySlug(cleaned);
  if (!cleaned || !slug || cleaned.length > 80) return 'Other';
  if (!postgres.isConfigured()) {
    const existing = localCategories().find((category) => category.slug === slug || category.name.toLowerCase() === cleaned.toLowerCase());
    if (existing) return existing.name;
    db.tables.categories.push({ id: `cat-auto-${slug}`, name: cleaned, slug, description: null, created_at: Math.floor(Date.now() / 1000) });
    db.saveDb();
    return cleaned;
  }
  await ensureSchema();
  const existing = await postgres.query('SELECT name FROM categories WHERE LOWER(name) = LOWER($1) OR slug = $2 ORDER BY created_at LIMIT 1', [cleaned, slug]);
  if (existing.rows[0]) return existing.rows[0].name;
  const result = await postgres.query(`INSERT INTO categories (id, name, slug, description, created_at)
    VALUES ($1, $2, $3, NULL, $4) ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING name`,
  [`cat-auto-${slug}`, cleaned, slug, Math.floor(Date.now() / 1000)]);
  return result.rows[0].name;
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
       AND (100.0 * (d.original_price - d.sale_price) / d.original_price) >= ${PUBLIC_MIN_DISCOUNT_PERCENT}
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

// Repair earlier imports that saved a marketplace department instead of one
// of our categories. Preserve categories explicitly created by the admin.
async function repairImportedCategories() {
  const known = new Set((await list()).map((category) => category.name.toLowerCase()));
  const canonicalNames = new Set(CANONICAL_CATEGORIES.map((category) => category.name.toLowerCase()));
  const candidates = postgres.isConfigured()
    ? (await postgres.query(`SELECT d.id, d.category, d.title FROM deals d
        WHERE d.category IS NULL OR LOWER(d.category) = 'other'
           OR NOT EXISTS (SELECT 1 FROM categories c WHERE LOWER(c.name) = LOWER(d.category))
           OR LOWER(COALESCE(d.category, '')) = ANY($1::text[])`, [[...canonicalNames]])).rows
    : db.tables.deals || [];
  let repaired = 0;
  for (const deal of candidates) {
    const old = String(deal.category || '').toLowerCase();
    const titleCategory = strongTitleCategory(deal.title);
    const strongMismatch = canonicalNames.has(old) && titleCategory && titleCategory.toLowerCase() !== old;
    if (known.has(old) && old !== 'other' && !strongMismatch) continue;
    const category = classifyCategory({ rawCategory: deal.category, title: deal.title });
    if (category === 'Other') continue;
    const registeredName = await ensureForDeal(category);
    if (registeredName === deal.category) continue;
    if (postgres.isConfigured()) {
      await postgres.query('UPDATE deals SET category = $1 WHERE id = $2 AND category IS NOT DISTINCT FROM $3', [registeredName, deal.id, deal.category]);
    } else {
      deal.category = registeredName;
    }
    repaired += 1;
  }
  if (repaired && !postgres.isConfigured()) db.saveDb();
  return repaired;
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

module.exports = { list, getById, create, update, remove, ensureSchema, ensureForDeal, repairImportedCategories, CANONICAL_CATEGORIES };
