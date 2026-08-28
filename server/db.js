const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

const tables = {
  users: [],
  categories: [],
  deals: [],
  bookmarks: [],
  price_alerts: [],
};

const nowUnix = () => Math.floor(Date.now() / 1000);

const DEFAULT_CATEGORIES = [
  { id: 'cat-electronics', name: 'Electronics', slug: 'electronics', description: 'Audio gear, laptops, accessories, and smart tech.' },
  { id: 'cat-home-kitchen', name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Cookware, appliances, and home organization essentials.' },
  { id: 'cat-sports-outdoors', name: 'Sports & Outdoors', slug: 'sports-outdoors', description: 'Fitness gear, hydration bottles, and outdoor equipment.' },
  { id: 'cat-health-beauty', name: 'Health & Beauty', slug: 'health-beauty', description: 'Personal grooming, wellness, and self-care essentials.' },
  { id: 'cat-amazon-devices', name: 'Amazon Devices', slug: 'amazon-devices', description: 'Kindle e-readers, Echo smart displays, and Fire devices.' },
];

function seedCategories() {
  if (tables.categories.length) return;
  tables.categories.push(...DEFAULT_CATEGORIES.map((category) => ({ ...category, created_at: nowUnix() })));
}

function removeLegacyDefaultAdmin() {
  tables.users = (tables.users || []).filter((user) => {
    const email = String(user?.email || '').toLowerCase();
    return user?.id !== 'usr-admin-1' && email !== 'admin@dealscout.local';
  });
}

function saveDb() {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(tables, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save DB:', err.message);
  }
}

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      for (const key of Object.keys(tables)) {
        tables[key] = Array.isArray(parsed?.[key]) ? parsed[key] : [];
      }
    }
  } catch (err) {
    console.error('Failed to load DB:', err.message);
    for (const key of Object.keys(tables)) tables[key] = [];
  }

  removeLegacyDefaultAdmin();
  seedCategories();
  saveDb();
}

function getDealPriceHistory() {
  // Price history must come from observed provider checks, never synthetic data.
  return [];
}

function expireDeal(idOrAsin, reason = 'Deal ended or price restored on Amazon') {
  const deal = tables.deals.find((item) => item.id === idOrAsin || item.asin === idOrAsin);
  if (!deal) return null;
  deal.is_expired = 1;
  deal.expired_at = nowUnix();
  deal.status = 'EXPIRED';
  deal.price_check_at = nowUnix();
  deal.raw_source_data = `${deal.raw_source_data || ''} | [EXPIRED: ${new Date().toISOString()} - ${reason}]`;
  saveDb();
  return { ...deal };
}

function restoreDeal(idOrAsin) {
  const deal = tables.deals.find((item) => item.id === idOrAsin || item.asin === idOrAsin);
  if (!deal) return null;
  deal.is_expired = 0;
  deal.expired_at = null;
  deal.status = 'APPROVED';
  deal.price_check_at = nowUnix();
  saveDb();
  return { ...deal };
}

function purgeExpiredDeals(maxAgeSeconds = 86400) {
  const threshold = nowUnix() - Number(maxAgeSeconds);
  const purgedDeals = tables.deals.filter((deal) =>
    (deal.is_expired === 1 || deal.status === 'EXPIRED') &&
    deal.expired_at && Number(deal.expired_at) <= threshold
  );

  if (purgedDeals.length) {
    tables.deals = tables.deals.filter((deal) => !purgedDeals.includes(deal));
    saveDb();
  }

  return {
    purgedCount: purgedDeals.length,
    purgedDeals: purgedDeals.map((deal) => ({
      id: deal.id,
      asin: deal.asin,
      title: deal.title,
      expiredAt: deal.expired_at,
    })),
    remainingTotal: tables.deals.length,
  };
}

function getDealLifecycleStats() {
  const now = nowUnix();
  const active = tables.deals.filter((deal) => !deal.is_expired && deal.status === 'APPROVED');
  const pending = tables.deals.filter((deal) => deal.status === 'PENDING_REVIEW');
  const expired = tables.deals.filter((deal) => deal.is_expired === 1 || deal.status === 'EXPIRED');
  return {
    total: tables.deals.length,
    activeCount: active.length,
    pendingCount: pending.length,
    expiredCount: expired.length,
    readyToPurgeCount: expired.filter((deal) => deal.expired_at && now - Number(deal.expired_at) >= 86400).length,
    autoPurgeRule: 'Expired listings are automatically permanently deleted 24 hours after detection.',
  };
}

function unsupportedPrepare() {
  return {
    get: () => null,
    all: () => [],
    run: () => ({ changes: 0 }),
  };
}

loadDb();

module.exports = {
  tables,
  saveDb,
  getDealPriceHistory,
  expireDeal,
  restoreDeal,
  purgeExpiredDeals,
  getDealLifecycleStats,
  exec: () => {},
  pragma: () => {},
  prepare: unsupportedPrepare,
};
