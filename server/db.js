const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// In-memory data store for AI Studio
const tables = {
  users: [],
  categories: [],
  deals: [],
};

const nowUnix = () => Math.floor(Date.now() / 1000);

// Seed Categories
const initialCategories = [
  { id: uuidv4(), name: 'Electronics', slug: 'electronics', description: 'Audio gear, laptops, accessories, and gadgets.', created_at: nowUnix() },
  { id: uuidv4(), name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Cookware, appliances, and home organization essentials.', created_at: nowUnix() },
  { id: uuidv4(), name: 'Sports & Outdoors', slug: 'sports-outdoors', description: 'Fitness gear, hydration bottles, and outdoor equipment.', created_at: nowUnix() },
  { id: uuidv4(), name: 'Health & Beauty', slug: 'health-beauty', description: 'Personal grooming, wellness, and self-care essentials.', created_at: nowUnix() },
  { id: uuidv4(), name: 'Amazon Devices', slug: 'amazon-devices', description: 'Kindle e-readers, Echo smart displays, and Fire devices.', created_at: nowUnix() },
];
tables.categories.push(...initialCategories);

// Seed Admin User
const adminPasswordHash = bcrypt.hashSync('admin123', 10);
tables.users.push({
  id: uuidv4(),
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

// Seed Deals
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
    pros: '• Exceptional active noise cancellation and transparency mode\n• Universal USB-C MagSafe charging case with precision tracking\n• Seamless device switching across the Apple ecosystem',
    cons: '• Premium price tag compared to budget alternatives\n• Advanced spatial audio features require Apple hardware',
    reviews: JSON.stringify([
      { author: 'Michael T.', text: 'The noise cancellation upgrade is genuinely noticeable on planes and commutes. Moving to USB-C means one less cable in my bag.', rating: 5 },
      { author: 'Sarah K.', text: 'Transparency mode sounds completely natural, as if nothing is in your ear. Great battery life too.', rating: 5 }
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
    pros: '• Class-leading noise cancellation across low and high frequencies\n• Superb 30-hour battery life with 3-minute quick charge\n• Ultra-comfortable lightweight design for long listening sessions',
    cons: '• Headband does not fold completely flat into a compact ball\n• Premium investment price point',
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
    pros: '• Crisp 300 ppi glare-free display that reads like real paper\n• Adjustable warm light for comfortable late-night reading\n• Waterproof construction and multi-week battery life',
    cons: '• Lock screen ads on the standard ad-supported model\n• Lacks wireless charging (available on Signature edition only)',
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
    pros: '• Cuts meal cooking time by up to 70% compared to traditional methods\n• Upgraded gentle steam release prevents countertop splatter\n• Dishwasher-safe stainless steel inner pot with anti-spin design',
    cons: '• Requires countertop space and learning curve for pressure recipes\n• Silicone sealing ring can absorb savory aromas over time',
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
    pros: '• Blazing fast 140W USB-C PD output charges MacBooks and high-draw laptops\n• Clear digital display with real-time wattage and health metrics\n• High 24,000mAh capacity provides multiple full phone charges',
    cons: '• Relatively heavy unit (630g / 1.4 lbs) for small everyday carry bags\n• Takes best advantage of 100W+ wall chargers for fast recharging',
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
    pros: '• Fast S9 processor with innovative hands-free double tap gesture\n• Brighter 2,000 nit screen visible under direct sunlight\n• Comprehensive suite of ECG and fitness tracking algorithms',
    cons: '• Requires daily charging with standard 18-hour battery longevity\n• Compatible only with Apple iPhone',
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
    pros: '• Iconic plush fit with zero ear clamp pressure\n• Simple physical button controls for reliable tactile response\n• Deep, rich acoustic profile with balanced EQ',
    cons: '• Lacks auto-pause sensor when removing from ears\n• Aware mode has slight ambient wind noise outdoors',
    reviews: JSON.stringify([
      { author: 'Daniel H.', text: 'Most comfortable headphones I have ever owned. Can wear for 8 hours without fatigue.', rating: 5 }
    ]),
    source_sufficient: 1,
    status: 'PENDING_REVIEW',
    raw_source_data: 'Rainforest API | ASIN: B098FH5P3C | Price: $229.00 (was $329.00) | Bose | Rating: 4.6/5.0 (24,310 reviews)',
    created_at: nowUnix() - 600,
  }
];
tables.deals.push(...initialDeals);

// Database Engine Interface
const db = {
  exec: (sql) => {},
  pragma: (sql) => {},
  prepare: (sql) => {
    const trimmed = sql.trim();
    const isSelect = /^SELECT/i.test(trimmed);
    const isInsert = /^INSERT/i.test(trimmed);
    const isUpdate = /^UPDATE/i.test(trimmed);
    const isDelete = /^DELETE/i.test(trimmed);

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
        all: (...params) => tables.users.map((x) => ({ ...x })),
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
            // otp registration: (id, email, password, otp_code, otp_expires)
            tables.users.push({
              id, email: email.toLowerCase(), password, role: 'user', verified: 0,
              otp_code: p4, otp_expires: p5, reset_token: null, reset_expires: null,
              created_at: nowUnix()
            });
          }
          return { changes: 1 };
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
            return { changes: 1 };
          }
          if (/otp_code = \?/i.test(trimmed)) {
            const [otp, expires, userId] = params;
            const u = tables.users.find((x) => x.id === userId);
            if (u) { u.otp_code = otp; u.otp_expires = expires; }
            return { changes: 1 };
          }
          if (/reset_token = \?/i.test(trimmed)) {
            const [token, expires, userId] = params;
            const u = tables.users.find((x) => x.id === userId);
            if (u) { u.reset_token = token; u.reset_expires = expires; }
            return { changes: 1 };
          }
          if (/password = \?/i.test(trimmed)) {
            const [pwd, userId] = params;
            const u = tables.users.find((x) => x.id === userId);
            if (u) { u.password = pwd; u.reset_token = null; u.reset_expires = null; }
            return { changes: 1 };
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
          return { changes: 1 };
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
          return { changes: 1 };
        }
      };
    }

    if (/DELETE FROM categories/i.test(trimmed)) {
      return {
        run: (id) => {
          const idx = tables.categories.findIndex((x) => x.id === id);
          if (idx !== -1) tables.categories.splice(idx, 1);
          return { changes: 1 };
        }
      };
    }

    // DEALS Table Operations
    if (/FROM deals/i.test(trimmed)) {
      return {
        get: (id) => {
          const d = tables.deals.find((x) => x.id === id);
          return d ? { ...d } : null;
        },
        all: (...params) => {
          let list = [...tables.deals];
          // Check for status filter
          if (/status = \?/i.test(trimmed)) {
            const statusIdx = trimmed.includes('category = ?') ? 0 : 0;
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
            original_price: p[4] || 0, sale_price: p[5] || 0, discount_percent: p[6] || 0,
            image_url: p[7], product_url: p[8], rating: p[9], ratings_total: p[10],
            short_bio: p[11], full_summary: p[12], pros: p[13], cons: p[14],
            reviews: p[15], source_sufficient: p[16], status: p[17] || 'PENDING_REVIEW',
            raw_source_data: p[18], created_at: nowUnix()
          });
          return { changes: 1 };
        }
      };
    }

    if (/UPDATE deals/i.test(trimmed)) {
      return {
        run: (...params) => {
          const id = params[params.length - 1];
          const d = tables.deals.find((x) => x.id === id);
          if (d) {
            // Check what fields were updated
            if (/status = \?/i.test(trimmed) && params.length === 2) {
              d.status = params[0];
            } else {
              // Generic update
              const fieldNamesMatch = trimmed.match(/SET\s+(.+)\s+WHERE/i);
              if (fieldNamesMatch) {
                const pairs = fieldNamesMatch[1].split(',').map((s) => s.trim().split('=')[0].trim());
                pairs.forEach((field, i) => {
                  d[field] = params[i];
                });
              }
            }
          }
          return { changes: 1 };
        }
      };
    }

    if (/DELETE FROM deals/i.test(trimmed)) {
      return {
        run: (id) => {
          const idx = tables.deals.findIndex((x) => x.id === id);
          if (idx !== -1) tables.deals.splice(idx, 1);
          return { changes: 1 };
        }
      };
    }

    // Default fallback
    return {
      get: () => null,
      all: () => [],
      run: () => ({ changes: 0 }),
    };
  }
};

module.exports = db;
