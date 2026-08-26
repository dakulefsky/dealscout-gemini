const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

// In-memory data store for AI Studio
let tables = {
  users: [],
  categories: [],
  deals: [],
  bookmarks: [],
  price_alerts: []
};

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
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      Object.assign(tables, JSON.parse(data));
    } else {
      seedDb();
      saveDb();
    }
  } catch (err) {
    console.error('Failed to load DB:', err.message);
    seedDb();
    saveDb();
  }
}

const nowUnix = () => Math.floor(Date.now() / 1000);

function seedDb() {
  // Seed Categories
  const initialCategories = [
    { id: 'cat-electronics', name: 'Electronics', slug: 'electronics', description: 'Audio gear, laptops, accessories, and smart tech.', created_at: nowUnix() },
    { id: 'cat-home-kitchen', name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Cookware, appliances, and home organization essentials.', created_at: nowUnix() },
    { id: 'cat-sports-outdoors', name: 'Sports & Outdoors', slug: 'sports-outdoors', description: 'Fitness gear, hydration bottles, and outdoor equipment.', created_at: nowUnix() },
    { id: 'cat-health-beauty', name: 'Health & Beauty', slug: 'health-beauty', description: 'Personal grooming, wellness, and self-care essentials.', created_at: nowUnix() },
    { id: 'cat-amazon-devices', name: 'Amazon Devices', slug: 'amazon-devices', description: 'Kindle e-readers, Echo smart displays, and Fire devices.', created_at: nowUnix() },
  ];
  tables.categories.push(...initialCategories);

  // Seed Admin User
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);
  tables.users.push({
    id: 'usr-admin-1',
    email: 'admin@dealscout.local',
    password: adminPasswordHash,
  role: 'admin',
  verified: 1,
  otp_code: null,
  otp_expires: null,
  reset_token: null,
  reset_expires: null,
  created_at: nowUnix(),
});

// Seed Initial Deals
const initialDeals = [
  {
    id: 'B0D1XD1ZV3',
    title: 'Apple AirPods Pro (2nd Gen) Wireless Earbuds with USB-C MagSafe Case',
    asin: 'B0D1XD1ZV3',
    category: 'Electronics',
    original_price: 249.00,
    sale_price: 189.00,
    discount_percent: 24,
    image_url: 'https://m.media-amazon.com/images/I/61SUj2aFiQQ._AC_SX679_.jpg',
    product_url: 'https://www.amazon.com/dp/B0D1XD1ZV3',
    rating: 4.8,
    ratings_total: 95402,
    short_bio: 'Industry-standard active noise cancellation with adaptive audio and universal USB-C charging.',
    full_summary: 'The second-generation AirPods Pro feature Apple’s H2 chip, delivering up to 2x more active noise cancellation over the previous generation. Adaptive Audio blends transparency and noise cancellation dynamically, and the updated MagSafe case features USB-C, a built-in speaker, and precision tracking.',
    pros: '• Custom low-distortion Apple driver & high dynamic range amplifier powered by the H2 processor, yielding wide acoustic separation and deep bass extension.\n• Next-generation computational active noise cancellation attenuating high-frequency speech and cabin rumble up to 2x more effectively.\n• IP54 dust and sweat resistance on both earbuds and MagSafe charging case with U1 Ultra Wideband precision finding and lanyard loop.',
    cons: '• High-resolution lossless audio transmission is restricted to Apple Vision Pro 5GHz wireless protocol.\n• Spatial Audio personalization, Find My tracking, and auto-switching require iOS/macOS hardware ecosystem.',
    reviews: JSON.stringify([
      {
        id: 'R3V1PRO2ND',
        author: 'Michael T.',
        title: 'Noticeable ANC improvement and USB-C convenience',
        text: 'The noise cancellation upgrade is genuinely noticeable on planes and daily transit. Switching the MagSafe case to USB-C means one less cable in my bag.',
        rating: 5,
        date: 'Oct 14, 2024',
        verifiedPurchase: true,
        helpfulVotes: 42,
        variantPurchased: 'Style: USB-C MagSafe Case'
      },
      {
        id: 'R1K8TR2P01',
        author: 'Sarah K.',
        title: 'Adaptive Audio is a game changer',
        text: 'Transparency mode sounds completely natural, as if nothing is in your ear. The microphone clarity on conference calls is noticeably better.',
        rating: 5,
        date: 'Nov 02, 2024',
        verifiedPurchase: true,
        helpfulVotes: 19,
        variantPurchased: 'Style: USB-C MagSafe Case'
      }
    ]),
    source_sufficient: 1,
    status: 'APPROVED',
    raw_source_data: 'Rainforest API | ASIN: B0D1XD1ZV3 | Price: $189.00 (was $249.00) | In Stock: Prime Eligible | Rating: 4.8/5.0 (95,402 reviews)',
    created_at: nowUnix() - 3600,
  },
  {
    id: 'B09XS7JWHH',
    title: 'Sony WH-1000XM5 Wireless Industry Leading Noise Canceling Headphones',
    asin: 'B09XS7JWHH',
    category: 'Electronics',
    original_price: 398.00,
    sale_price: 328.00,
    discount_percent: 18,
    image_url: 'https://m.media-amazon.com/images/I/51aXvjzcukL._AC_SX679_.jpg',
    product_url: 'https://www.amazon.com/dp/B09XS7JWHH',
    rating: 4.6,
    ratings_total: 14502,
    short_bio: 'Flagship over-ear headphones with dual processors and 8 microphones for unmatched silence.',
    full_summary: 'Sony WH-1000XM5 provides state-of-the-art active noise cancellation powered by two processors and eight microphones. With Auto NC Optimizer and lightweight soft fit leather, these headphones offer 30 hours of battery life and crystal-clear hands-free calling.',
    pros: '• Dual integrated processors (V1 + QN1) driving 8 beamforming microphones with Auto NC Optimizer for real-time acoustic barometric calibration.\n• Lightweight 30mm carbon-fiber composite dome drivers delivering precise high-frequency responsiveness and low-distortion LDAC playback.\n• Industry-leading 30-hour battery longevity with 3-minute Power Delivery boost yielding 3 hours of playback.',
    cons: '• Non-folding earcups require a larger footprint travel case compared to legacy folding chassis.\n• Multi-point Bluetooth connection automatically disables Sony high-bitrate LDAC audio stream.',
    reviews: JSON.stringify([
      { author: 'David L.', text: 'Best ANC on the market. Worked wonders in a noisy open office environment.', rating: 5 },
      { author: 'Elena R.', text: 'Soundstage is punchy and detailed. Call quality is vastly improved from the XM4.', rating: 5 }
    ]),
    source_sufficient: 1,
    status: 'APPROVED',
    raw_source_data: 'Rainforest API | ASIN: B09XS7JWHH | Price: $328.00 (was $398.00) | Sony Store | Rating: 4.6/5.0 (14,502 reviews)',
    created_at: nowUnix() - 7200,
  },
  {
    id: 'B0BG3Z5L5D',
    title: 'Kindle Paperwhite (16 GB) – 6.8" Display with Adjustable Warm Light',
    asin: 'B0BG3Z5L5D',
    category: 'Amazon Devices',
    original_price: 149.99,
    sale_price: 134.99,
    discount_percent: 10,
    image_url: 'https://m.media-amazon.com/images/I/61t04yL2WqL._AC_SX679_.jpg',
    product_url: 'https://www.amazon.com/dp/B0BG3Z5L5D',
    rating: 4.7,
    ratings_total: 48920,
    short_bio: 'Glare-free 300 ppi display with IPX8 waterproofing and battery life measured in weeks.',
    full_summary: 'The Kindle Paperwhite features a 6.8” glare-free display with thinner borders, adjustable warm light, up to 10 weeks of battery life, and 20% faster page turns. IPX8 waterproof rating ensures peace of mind at the beach or poolside.',
    pros: '• Flush-front 6.8-inch 300 ppi E-Ink Carta 1200 panel with 20% faster page refresh cycle latency and crisp micro-etched glare resistance.\n• 17-LED array with dual-hue temperature calibration (white to amber) for circadian-friendly night reading.\n• IPX8 lab-tested submersion waterproofing up to 2 meters for 60 minutes in fresh water with 10-week single-charge endurance.',
    cons: '• Standard model incorporates Amazon lockscreen sponsored screensavers unless opting for ad-free tier.\n• Qi wireless inductive charging is omitted on the base 16GB tier (reserved for Signature Edition).',
    reviews: JSON.stringify([
      { author: 'Amanda B.', text: 'The warm light adjustment makes nighttime reading so easy on the eyes.', rating: 5 },
      { author: 'Chris P.', text: 'Battery lasted through a 2-week vacation without needing a single charge.', rating: 5 }
    ]),
    source_sufficient: 1,
    status: 'APPROVED',
    raw_source_data: 'Rainforest API | ASIN: B0BG3Z5L5D | Price: $134.99 (was $149.99) | Amazon Devices | Rating: 4.7/5.0 (48,920 reviews)',
    created_at: nowUnix() - 10800,
  },
  {
    id: 'B07W55DDFB',
    title: 'Instant Pot Duo Plus 9-in-1 Electric Multi-Cooker (6 Quart)',
    asin: 'B07W55DDFB',
    category: 'Home & Kitchen',
    original_price: 129.99,
    sale_price: 89.95,
    discount_percent: 31,
    image_url: 'https://m.media-amazon.com/images/I/71V1GYuR5jL._AC_SX679_.jpg',
    product_url: 'https://www.amazon.com/dp/B07W55DDFB',
    rating: 4.7,
    ratings_total: 62410,
    short_bio: 'Versatile multi-cooker replacing 9 kitchen appliances with whisper-quiet steam release.',
    full_summary: 'Instant Pot Duo Plus combines pressure cooking, slow cooking, rice cooking, yogurt making, sous vide, and sautéing into one compact kitchen countertop appliance. Easy-release steam switch and an intuitive status bar make meal prep fast and mess-free.',
    pros: '• 15-PSI micro-processor controlled thermodynamic cooking reducing cook cycle durations by up to 70% while retaining moisture.\n• Upgraded whisper-quiet steam diffusion shroud eliminating aerosolized countertop splatter during rapid depressurization.\n• Heavy-gauge 3-ply 304 food-grade stainless steel inner cooking pot with anti-spin locking tabs for easy stirring.',
    cons: '• 6-quart footprint requires dedicated 13-inch vertical countertop clearance and dedicated cupboard storage.\n• Food-grade silicone sealing gaskets can retain aromatic spice volatiles over extended culinary cycles.',
    reviews: JSON.stringify([
      { author: 'Jason M.', text: 'Saves so much time making weeknight dinners and pot roasts. Highly recommended.', rating: 5 },
      { author: 'Laura C.', text: 'The sous vide and sauté functions work exceptionally well.', rating: 5 }
    ]),
    source_sufficient: 1,
    status: 'APPROVED',
    raw_source_data: 'Rainforest API | ASIN: B07W55DDFB | Price: $89.95 (was $129.99) | Instant Pot | Rating: 4.7/5.0 (62,410 reviews)',
    created_at: nowUnix() - 14400,
  },
  {
    id: 'B0B1NX51M4',
    title: 'Anker 737 Power Bank (PowerCore 24K, 140W Two-Way Fast Charging)',
    asin: 'B0B1NX51M4',
    category: 'Electronics',
    original_price: 149.99,
    sale_price: 109.99,
    discount_percent: 27,
    image_url: 'https://m.media-amazon.com/images/I/61v2gUjXFwL._AC_SX679_.jpg',
    product_url: 'https://www.amazon.com/dp/B0B1NX51M4',
    rating: 4.6,
    ratings_total: 8930,
    short_bio: 'Ultra-powerful 24,000mAh battery pack with smart digital display and 140W Power Delivery.',
    full_summary: 'Equipped with Power Delivery 3.1 and bi-directional charging, the Anker 737 power bank can charge laptops, tablets, and phones simultaneously. The real-time smart display shows battery percentage, output wattage, and estimated recharge times.',
    pros: '• Power Delivery 3.1 bidirectional architecture delivering continuous 140W single-port throughput capable of fast-charging 16" MacBook Pro.\n• ActiveShield 2.0 real-time thermal monitoring system taking 3,000,000+ temperature readings daily to prevent battery cell degradation.\n• Integrated color TFT screen reporting real-time per-port input/output wattage, internal cell temperatures, and battery health cycle metrics.',
    cons: '• Substantial 630-gram (1.39 lb) chassis creates noticeable heft inside minimalist everyday-carry bags.\n• Requires a compatible 100W+ USB-C Power Delivery wall charger to achieve the rapid 52-minute full recharge speed.',
    reviews: JSON.stringify([
      { author: 'Robert G.', text: 'Charges my MacBook Pro at full speed while working remotely. A road warrior must-have.', rating: 5 }
    ]),
    source_sufficient: 1,
    status: 'APPROVED',
    raw_source_data: 'Rainforest API | ASIN: B0B1NX51M4 | Price: $109.99 (was $149.99) | Anker | Rating: 4.6/5.0 (8,930 reviews)',
    created_at: nowUnix() - 18000,
  },
  {
    id: 'B0BDHZ5Q3Z',
    title: 'Apple Watch Series 9 GPS 41mm Smartwatch (Midnight Aluminum)',
    asin: 'B0BDHZ5Q3Z',
    category: 'Electronics',
    original_price: 399.00,
    sale_price: 329.00,
    discount_percent: 18,
    image_url: 'https://m.media-amazon.com/images/I/71XMTLt45UL._AC_SX679_.jpg',
    product_url: 'https://www.amazon.com/dp/B0BDHZ5Q3Z',
    rating: 4.7,
    ratings_total: 18200,
    short_bio: 'Powered by the S9 SiP with Double Tap gesture control and brighter edge-to-edge display.',
    full_summary: 'The Series 9 brings the revolutionary Double Tap gesture, faster on-device Siri with health access, and a display that reaches up to 2000 nits. Advanced health sensors track blood oxygen, ECG, sleep stages, and temperature changes.',
    pros: '• S9 SiP with 5.6 billion transistors and a dedicated 4-core Neural Engine executing on-device Siri requests with zero network latency.\n• Next-generation optical heart sensor paired with electrical ECG and temperature sensors delivering clinical-grade metric tracking.\n• High-efficiency OLED display delivering 2,000 nits peak outdoor luminance and stepping down to 1 nit in low-light environments.',
    cons: '• Nominal 18-hour battery longevity requires habitual daily charging routines.\n• Complete device initialization and health telemetry synchronization strictly require an Apple iPhone.',
    reviews: JSON.stringify([
      { author: 'Nathan S.', text: 'The double tap feature is surprisingly useful when carrying groceries.', rating: 5 }
    ]),
    source_sufficient: 1,
    status: 'PENDING_REVIEW',
    raw_source_data: 'Rainforest API | ASIN: B0BDHZ5Q3Z | Price: $329.00 (was $399.00) | Apple | Rating: 4.7/5.0 (18,200 reviews)',
    created_at: nowUnix() - 1200,
  },
  {
    id: 'B098FH5P3C',
    title: 'Bose QuietComfort 45 Bluetooth Wireless Noise Cancelling Headphones',
    asin: 'B098FH5P3C',
    category: 'Electronics',
    original_price: 329.00,
    sale_price: 229.00,
    discount_percent: 30,
    image_url: 'https://m.media-amazon.com/images/I/51JbsHSktkL._AC_SX679_.jpg',
    product_url: 'https://www.amazon.com/dp/B098FH5P3C',
    rating: 4.6,
    ratings_total: 24310,
    short_bio: 'Legendary quiet, lightweight comfort, and acoustic noise canceling technology.',
    full_summary: 'The Bose QC45 headphones balance iconic noise cancelling silence with plush synthetic leather cushions for all-day comfort. Features Quiet and Aware modes with up to 24 hours of playback on a single charge.',
    pros: '• TriPort acoustic headphone structure utilizing external vents to equalize ear pressure and reproduce deep, full-bodied resonance.\n• Proprietary synthetic protein leather earcup cushions providing minimal clamp force and comfortable 8+ hour continuous wear.\n• Dedicated physical actuation buttons preventing accidental touch triggers while adjusting or wearing winter gloves.',
    cons: '• Acoustic transparency Aware Mode can amplify sharp ambient wind gusts during brisk outdoor walks.\n• Lacks automatic capacitive wear-detection to pause audio when removed from the head.',
    reviews: JSON.stringify([
      { author: 'Daniel H.', text: 'Most comfortable headphones I have ever owned. Can wear for 8 hours without fatigue.', rating: 5 }
    ]),
    source_sufficient: 1,
    status: 'PENDING_REVIEW',
    is_expired: 0,
    expired_at: null,
    price_check_at: nowUnix() - 600,
    raw_source_data: 'Rainforest API | ASIN: B098FH5P3C | Price: $229.00 (was $329.00) | Bose | Rating: 4.6/5.0 (24,310 reviews)',
    created_at: nowUnix() - 600,
  }
];

// Ensure all initial deals have expiration lifecycle fields
initialDeals.forEach((d) => {
  if (d.is_expired === undefined) d.is_expired = 0;
  if (d.expired_at === undefined) d.expired_at = null;
  if (d.price_check_at === undefined) d.price_check_at = nowUnix();
});

tables.deals.push(...initialDeals);
} // End of seedDb

// Load DB immediately upon startup
loadDb();

/**
 * Generate simulated 30-day price history for interactive chart
 */
function getDealPriceHistory(deal) {
  if (!deal) return [];
  const current = Number(deal.sale_price || deal.price || 99);
  const orig = Number(deal.original_price || deal.originalPrice || current * 1.25);
  const diff = orig - current;
  const history = [];

  const days = [30, 24, 18, 14, 10, 7, 5, 3, 2, 1, 0];
  days.forEach((d, idx) => {
    let p;
    if (d > 14) {
      p = orig;
    } else if (d > 7) {
      p = Number((orig - diff * 0.4).toFixed(2));
    } else if (d > 3) {
      p = Number((orig - diff * 0.7).toFixed(2));
    } else {
      p = current;
    }
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    history.push({
      day: d === 0 ? 'Today' : `${d}d ago`,
      date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: p,
      listPrice: orig,
      isLowest: p === current,
    });
  });

  return history;
}

/**
 * Marks a deal as Expired / Ended (starts 24-hour auto-purge countdown)
 */
function expireDeal(idOrAsin, reason = 'Deal ended or price restored on Amazon') {
  const d = tables.deals.find((x) => x.id === idOrAsin || x.asin === idOrAsin);
  if (!d) return null;

  d.is_expired = 1;
  d.expired_at = nowUnix();
  d.status = 'EXPIRED';
  d.price_check_at = nowUnix();
  d.raw_source_data = `${d.raw_source_data || ''} | [EXPIRED: ${new Date().toISOString()} - ${reason}]`;

  return { ...d };
}

/**
 * Restores an expired deal back to active/approved
 */
function restoreDeal(idOrAsin) {
  const d = tables.deals.find((x) => x.id === idOrAsin || x.asin === idOrAsin);
  if (!d) return null;

  d.is_expired = 0;
  d.expired_at = null;
  d.status = 'APPROVED';
  d.price_check_at = nowUnix();

  return { ...d };
}

/**
 * Automatically purges expired deals that have been expired for >= maxAgeSeconds (default: 86400s / 24 hours).
 * This implements: "automatically grey out a deal if the deal ends and a day later delete it"
 */
function purgeExpiredDeals(maxAgeSeconds = 86400) {
  const now = nowUnix();
  const toDelete = [];
  const kept = [];

  for (const deal of tables.deals) {
    const isExpired = deal.is_expired === 1 || deal.status === 'EXPIRED';
    if (isExpired && deal.expired_at && (now - deal.expired_at) >= maxAgeSeconds) {
      toDelete.push({
        id: deal.id,
        asin: deal.asin,
        title: deal.title,
        expiredAt: deal.expired_at,
        expiredHoursAgo: ((now - deal.expired_at) / 3600).toFixed(1),
      });
    } else {
      kept.push(deal);
    }
  }

  tables.deals = kept;
  return {
    purgedCount: toDelete.length,
    purgedDeals: toDelete,
    remainingTotal: tables.deals.length,
  };
}

/**
 * Calculates deal lifecycle and purge stats.
 */
function getDealLifecycleStats() {
  const now = nowUnix();
  const deals = tables.deals || [];
  
  const active = deals.filter((d) => !d.is_expired && d.status === 'APPROVED');
  const pending = deals.filter((d) => d.status === 'PENDING_REVIEW');
  const expired = deals.filter((d) => d.is_expired === 1 || d.status === 'EXPIRED');
  
  // Ready to delete (expired >= 24h)
  const readyToPurge = expired.filter((d) => d.expired_at && (now - d.expired_at) >= 86400);

  return {
    total: deals.length,
    activeCount: active.length,
    pendingCount: pending.length,
    expiredCount: expired.length,
    readyToPurgeCount: readyToPurge.length,
    autoPurgeRule: 'Expired listings are automatically permanently deleted 24 hours after detection.',
  };
}

// Database Engine Interface
const db = {
  tables,
  saveDb,
  getDealPriceHistory,
  expireDeal,
  restoreDeal,
  purgeExpiredDeals,
  getDealLifecycleStats,
  exec: (sql) => {},
  pragma: (sql) => {},
  prepare: (sql) => {
    const trimmed = sql.trim();

    // USERS Table Operations
    if (/FROM users/i.test(trimmed)) {
      return {
        get: (param) => {
          if (/WHERE id = \?/i.test(trimmed)) {
            const u = tables.users.find((x) => x.id === param);
            return u ? { ...u } : null;
          }
          if (/WHERE email = \?/i.test(trimmed)) {
            const u = tables.users.find((x) => x.email.toLowerCase() === (param || '').toLowerCase());
            return u ? { ...u } : null;
          }
          if (/WHERE reset_token = \?/i.test(trimmed)) {
            const u = tables.users.find((x) => x.reset_token === param);
            return u ? { ...u } : null;
          }
          if (/WHERE role = \?/i.test(trimmed)) {
            const u = tables.users.find((x) => x.role === param);
            return u ? { ...u } : null;
          }
          return null;
        },
        all: () => tables.users.map((x) => ({ ...x })),
        run: () => ({ changes: 0 }),
      };
    }

    if (/INSERT INTO users/i.test(trimmed)) {
      return {
        run: (id, email, password, p4, p5) => {
          if (p4 === 'admin') {
            tables.users.push({
              id, email: email.toLowerCase(), password, role: p4, verified: p5 ?? 1,
              otp_code: null, otp_expires: null, reset_token: null, reset_expires: null,
              created_at: nowUnix()
            });
          } else {
            tables.users.push({
              id, email: email.toLowerCase(), password, role: 'user', verified: 0,
              otp_code: p4, otp_expires: p5, reset_token: null, reset_expires: null,
              created_at: nowUnix()
            });
          }
          saveDb(); return { changes: 1 };
        }
      };
    }

    if (/UPDATE users/i.test(trimmed)) {
      return {
        run: (...params) => {
          if (/verified = 1/i.test(trimmed)) {
            const userId = params[0];
            const u = tables.users.find((x) => x.id === userId);
            if (u) { u.verified = 1; u.otp_code = null; u.otp_expires = null; }
            saveDb(); return { changes: 1 };
          }
          if (/otp_code = \?/i.test(trimmed)) {
            const [otp, expires, userId] = params;
            const u = tables.users.find((x) => x.id === userId);
            if (u) { u.otp_code = otp; u.otp_expires = expires; }
            saveDb(); return { changes: 1 };
          }
          if (/reset_token = \?/i.test(trimmed)) {
            const [token, expires, userId] = params;
            const u = tables.users.find((x) => x.id === userId);
            if (u) { u.reset_token = token; u.reset_expires = expires; }
            saveDb(); return { changes: 1 };
          }
          if (/password = \?/i.test(trimmed)) {
            const [pwd, userId] = params;
            const u = tables.users.find((x) => x.id === userId);
            if (u) { u.password = pwd; u.reset_token = null; u.reset_expires = null; }
            saveDb(); return { changes: 1 };
          }
          return { changes: 0 };
        }
      };
    }

    // CATEGORIES Table Operations
    if (/FROM categories/i.test(trimmed)) {
      return {
        get: (param) => {
          if (/WHERE slug = \?/i.test(trimmed)) {
            const c = tables.categories.find((x) => x.slug === param);
            return c ? { ...c } : null;
          }
          if (/WHERE id = \?/i.test(trimmed)) {
            const c = tables.categories.find((x) => x.id === param);
            return c ? { ...c } : null;
          }
          return null;
        },
        all: () => [...tables.categories].sort((a, b) => a.name.localeCompare(b.name)).map((x) => ({ ...x })),
        run: () => ({ changes: 0 }),
      };
    }

    if (/INSERT INTO categories/i.test(trimmed)) {
      return {
        run: (id, name, slug, description) => {
          tables.categories.push({ id, name, slug, description, created_at: nowUnix() });
          saveDb(); return { changes: 1 };
        }
      };
    }

    if (/UPDATE categories/i.test(trimmed)) {
      return {
        run: (...params) => {
          const id = params[params.length - 1];
          const c = tables.categories.find((x) => x.id === id);
          if (c) {
            if (params.length === 4) {
              c.name = params[0] ?? c.name;
              c.slug = params[1] ?? c.slug;
              c.description = params[2] ?? c.description;
            }
          }
          saveDb(); return { changes: 1 };
        }
      };
    }

    if (/DELETE FROM categories/i.test(trimmed)) {
      return {
        run: (id) => {
          const idx = tables.categories.findIndex((x) => x.id === id);
          if (idx !== -1) tables.categories.splice(idx, 1);
          saveDb(); return { changes: 1 };
        }
      };
    }

    // DEALS Table Operations
    if (/FROM deals/i.test(trimmed)) {
      return {
        get: (id) => {
          const d = tables.deals.find((x) => x.id === id || x.asin === id);
          return d ? { ...d } : null;
        },
        all: (...params) => {
          let list = [...tables.deals];
          if (/status = \?/i.test(trimmed)) {
            const statusVal = params[0];
            list = list.filter((x) => x.status === statusVal);
          }
          if (/category = \?/i.test(trimmed)) {
            const catVal = params[trimmed.includes('status = ?') ? 1 : 0];
            if (catVal) list = list.filter((x) => x.category === catVal);
          }
          if (/ORDER BY created_at DESC/i.test(trimmed)) {
            list.sort((a, b) => b.created_at - a.created_at);
          } else if (/ORDER BY created_at ASC/i.test(trimmed)) {
            list.sort((a, b) => a.created_at - b.created_at);
          }
          const limit = Number(params[params.length - 1]) || 100;
          return list.slice(0, limit).map((x) => ({ ...x }));
        },
        run: () => ({ changes: 0 }),
      };
    }

    if (/INSERT INTO deals/i.test(trimmed)) {
      return {
        run: (...p) => {
          tables.deals.push({
            id: p[0], title: p[1], asin: p[2], category: p[3],
            original_price: Number(p[4]) || 0, sale_price: Number(p[5]) || 0, discount_percent: Number(p[6]) || 0,
            image_url: p[7], product_url: p[8], rating: Number(p[9]) || 4.5, ratings_total: Number(p[10]) || 100,
            short_bio: p[11], full_summary: p[12], pros: p[13], cons: p[14],
            reviews: typeof p[15] === 'string' ? p[15] : JSON.stringify(p[15] || []),
            source_sufficient: p[16] ?? 1, status: p[17] || 'PENDING_REVIEW',
            raw_source_data: p[18] || '', created_at: nowUnix()
          });
          saveDb(); return { changes: 1 };
        }
      };
    }

    if (/UPDATE deals/i.test(trimmed)) {
      return {
        run: (...params) => {
          const id = params[params.length - 1];
          const d = tables.deals.find((x) => x.id === id || x.asin === id);
          if (d) {
            if (/status = \?/i.test(trimmed) && params.length === 2) {
              d.status = params[0];
            } else {
              const fieldNamesMatch = trimmed.match(/SET\s+(.+)\s+WHERE/i);
              if (fieldNamesMatch) {
                const pairs = fieldNamesMatch[1].split(',').map((s) => s.trim().split('=')[0].trim());
                pairs.forEach((field, i) => {
                  d[field] = params[i];
                });
              }
            }
          }
          saveDb(); return { changes: 1 };
        }
      };
    }

    if (/DELETE FROM deals/i.test(trimmed)) {
      return {
        run: (id) => {
          const idx = tables.deals.findIndex((x) => x.id === id || x.asin === id);
          if (idx !== -1) tables.deals.splice(idx, 1);
          saveDb(); return { changes: 1 };
        }
      };
    }

    return {
      get: () => null,
      all: () => [],
      run: () => ({ changes: 0 }),
    };
  }
};

module.exports = db;
