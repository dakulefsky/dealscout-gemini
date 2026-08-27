const db = require('../db');
const postgres = require('../storage/postgres');

let schemaReady = false;

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

  const count = await postgres.query('SELECT COUNT(*)::int AS count FROM categories');
  if (count.rows[0].count === 0 && Array.isArray(db.tables.categories) && db.tables.categories.length) {
    for (const category of db.tables.categories) {
      await postgres.query(
        `INSERT INTO categories (id, name, slug, description, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [category.id, category.name, category.slug, category.description || null, category.created_at || Math.floor(Date.now() / 1000)]
      );
    }
  }
  schemaReady = true;
}

async function list({ slug } = {}) {
  if (!postgres.isConfigured()) {
    let rows = [...(db.tables.categories || [])];
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
    const category = (db.tables.categories || []).find((c) => c.id === id);
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

module.exports = { list, getById, create, update, remove, ensureSchema };
