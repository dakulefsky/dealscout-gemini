const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const AMAZON_ASSOCIATE_TAG = process.env.AMAZON_ASSOCIATE_TAG || 'dealscout-20';

// Curated queue pool for demo / seed fetching
const SAMPLE_DEAL_POOL = [
  {
    asin: 'B08PZHYWJS',
    title: 'Apple AirPods Max Wireless Over-Ear Headphones (Space Gray)',
    category: 'Electronics',
    original_price: 549.00,
    sale_price: 449.00,
    discount_percent: 18,
    image_url: 'https://m.media-amazon.com/images/I/81jqUPkIVRL._AC_SX679_.jpg',
    product_url: 'https://www.amazon.com/dp/B08PZHYWJS',
    rating: 4.6,
    ratings_total: 13920,
    short_bio: 'High-fidelity audio with active noise cancellation and computational spatial audio.',
    full_summary: 'Apple-designed dynamic driver provides high-fidelity audio. Active Noise Cancellation with Transparency mode, knit-mesh canopy and memory foam ear cushions for exceptional acoustic seal.',
    pros: '• Exceptional acoustic depth and spatial audio\n• Premium stainless steel and aluminum build\n• Seamless device switching across Apple devices',
    cons: '• Heavy build compared to plastic competitors\n• Smart Case offers minimal travel protection',
    reviews: JSON.stringify([
      { author: 'Marcus B.', text: 'The soundstage is unreal and spatial audio movies feel like an IMAX theater.', rating: 5 }
    ]),
    source_sufficient: 1,
    raw_source_data: 'Rainforest API | ASIN: B08PZHYWJS | Title: Apple AirPods Max | Price: $449.00 (was $549.00) | Apple Store'
  },
  {
    asin: 'B09BS26B8B',
    title: 'Kindle Scribe (16 GB) – 10.2" 300 ppi Paperwhite Display with Premium Pen',
    category: 'Amazon Devices',
    original_price: 369.99,
    sale_price: 279.99,
    discount_percent: 24,
    image_url: 'https://m.media-amazon.com/images/I/61k092f6F8L._AC_SX679_.jpg',
    product_url: 'https://www.amazon.com/dp/B09BS26B8B',
    rating: 4.5,
    ratings_total: 8240,
    short_bio: 'First Kindle for reading and writing, with glare-free 10.2” 300 ppi Front-lit display.',
    full_summary: 'Read and write naturally as you would on paper. Convert handwritten notes to text and email them to colleagues, review PDFs, and take notes in millions of titles in the Kindle Store.',
    pros: '• Expansive 10.2 inch 300 ppi paper-like canvas\n• Pen never needs charging or pairing\n• Months of battery life for reading',
    cons: '• Larger footprint makes one-handed reading difficult\n• Software notebook templates are relatively basic',
    reviews: JSON.stringify([
      { author: 'Jessica W.', text: 'Replaced all my paper notebooks for client meetings.', rating: 5 }
    ]),
    source_sufficient: 1,
    raw_source_data: 'Rainforest API | ASIN: B09BS26B8B | Title: Kindle Scribe 16GB | Price: $279.99 (was $369.99) | Amazon Devices'
  },
  {
    asin: 'B08N5WRWNW',
    title: 'Apple MacBook Air 13.3" Laptop with M1 Chip (8GB RAM, 256GB SSD)',
    category: 'Electronics',
    original_price: 999.00,
    sale_price: 699.00,
    discount_percent: 30,
    image_url: 'https://m.media-amazon.com/images/I/71jG+e7roXL._AC_SX679_.jpg',
    product_url: 'https://www.amazon.com/dp/B08N5WRWNW',
    rating: 4.8,
    ratings_total: 21980,
    short_bio: 'Fanless ultraportable laptop with 18 hours of battery life and Retina display.',
    full_summary: 'Supercharged by Apple M1 chip with 8-core CPU and up to 18 hours of battery life. Completely silent, fanless design with a crisp 13.3-inch Retina display.',
    pros: '• Groundbreaking performance-per-watt and silent fanless design\n• Incredible battery life lasting full workdays\n• Aluminum unibody build quality and responsive trackpad',
    cons: '• Limited to two Thunderbolt / USB-4 ports\n• Base model 8GB RAM is not user-upgradable',
    reviews: JSON.stringify([
      { author: 'Kevin T.', text: 'Best value laptop on the market even years after release.', rating: 5 }
    ]),
    source_sufficient: 1,
    raw_source_data: 'Rainforest API | ASIN: B08N5WRWNW | Title: MacBook Air M1 | Price: $699.00 (was $999.00) | Apple Store'
  }
];

// POST /api/functions/amazon-redirect
// Appends affiliate tag to any Amazon product URL
router.post('/amazon-redirect', (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid url' });
  }
  let redirectUrl;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('tag', AMAZON_ASSOCIATE_TAG);
    redirectUrl = parsed.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    redirectUrl = url + sep + 'tag=' + AMAZON_ASSOCIATE_TAG;
  }
  res.json({ redirectUrl, tag: AMAZON_ASSOCIATE_TAG });
});

// POST /api/functions/fetch-deals
router.post('/fetch-deals', requireAdmin, async (req, res) => {
  let created = 0;
  const skipped = [];

  for (const sample of SAMPLE_DEAL_POOL) {
    const existing = db.prepare('SELECT id FROM deals WHERE asin = ?').get(sample.asin);
    if (existing) {
      skipped.push(sample.asin);
      continue;
    }

    const id = sample.asin || uuidv4();
    db.prepare(`
      INSERT INTO deals (
        id, title, asin, category, original_price, sale_price, discount_percent,
        image_url, product_url, rating, ratings_total, short_bio, full_summary,
        pros, cons, reviews, source_sufficient, status, raw_source_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sample.title,
      sample.asin,
      sample.category,
      sample.original_price,
      sample.sale_price,
      sample.discount_percent,
      sample.image_url,
      sample.product_url,
      sample.rating,
      sample.ratings_total,
      sample.short_bio,
      sample.full_summary,
      sample.pros,
      sample.cons,
      sample.reviews,
      sample.source_sufficient,
      'PENDING_REVIEW',
      sample.raw_source_data
    );
    created++;
  }

  res.json({
    created,
    skipped,
    message: `Processed ${SAMPLE_DEAL_POOL.length} deals. ${created} added to Pending Review.`
  });
});

module.exports = router;
