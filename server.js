import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createServer as createViteServer } from 'vite';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function hardenJsonUsers(db) {
  const beforeUsers = db.tables.users.length;
  db.tables.users = db.tables.users.filter((user) => user.id !== 'usr-admin-1' && user.email !== 'admin@dealscout.local');
  if (db.tables.users.length !== beforeUsers) db.saveDb();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigin = process.env.FRONTEND_URL;

  if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
  }
  if (isProduction && !String(process.env.AMAZON_ASSOCIATE_TAG || '').trim()) {
    throw new Error('AMAZON_ASSOCIATE_TAG must be configured in production');
  }

  const db = require('./server/db.js');
  const dealRepository = require('./server/repositories/dealRepository.js');
  const userRepository = require('./server/repositories/userRepository.js');
  const categoryRepository = require('./server/repositories/categoryRepository.js');
  const bookmarkRepository = require('./server/repositories/bookmarkRepository.js');
  const editorialRepository = require('./server/repositories/editorialRepository.js');
  const activityRepository = require('./server/repositories/activityRepository.js');
  const seo = require('./server/services/seoService.js');
  if (isProduction) hardenJsonUsers(db);

  await Promise.all([
    dealRepository.ensureSchema(), userRepository.ensureSchema(), categoryRepository.ensureSchema(),
    editorialRepository.ensureSchema(), activityRepository.ensureSchema(),
  ]);
  await bookmarkRepository.ensureSchema();
  if (isProduction) await dealRepository.hardenProduction();

  app.disable('x-powered-by');
  const { securityHeaders, apiRateLimit } = require('./server/middleware/securityBaseline.js');
  app.use(securityHeaders);
  app.use(cors({ origin: isProduction ? (configuredOrigin || false) : true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(apiRateLimit());

  const amazonContentPolicy = require('./server/middleware/amazonContentPolicy.js');
  app.use(amazonContentPolicy.blockThirdPartyAmazonReviews);
  app.use(amazonContentPolicy.strictRainforestSearch);
  app.use(require('./server/middleware/adminActivityAudit.js').adminActivityAudit);

  app.get('/robots.txt', (req, res) => res.type('text/plain').send(seo.buildRobots(seo.siteBase(req, configuredOrigin))));
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const [allDeals, categories] = await Promise.all([dealRepository.listAll(), categoryRepository.list()]);
      const liveDeals = allDeals.filter((d) => d.status === 'APPROVED' && d.source_verified === 1 && d.is_expired !== 1);
      res.type('application/xml').send(seo.buildSitemap({ baseUrl: seo.siteBase(req, configuredOrigin), deals: liveDeals, categories }));
    } catch (err) {
      console.warn('[DealScout] Sitemap generation failed:', err.message);
      res.status(503).type('text/plain').send('Sitemap temporarily unavailable');
    }
  });

  app.use('/api/auth/register', (req, res, next) => {
    if (process.env.ALLOW_PUBLIC_REGISTRATION === 'true') return next();
    return res.status(404).json({ error: 'Not found' });
  });
  app.use('/api/auth', require('./server/routes/auth.js'));
  app.use('/api/deals', require('./server/routes/priceHistory.js'));
  app.use('/api/deals', require('./server/middleware/verifiedAiIngestGuard.js').verifiedAiIngestGuard);
  app.use('/api/deals', require('./server/routes/deals.js'));
  app.use('/api/editorial', require('./server/routes/editorial.js'));
  app.use('/api/categories', require('./server/routes/categories.js'));
  app.use('/api/functions', require('./server/middleware/imageRepairEndpoint.js').imageRepairEndpoint);
  app.use('/api/functions', require('./server/middleware/integrityHealthEndpoint.js').integrityHealthEndpoint);
  app.use('/api/functions', require('./server/middleware/legacyEnrichmentCleanupEndpoint.js').legacyEnrichmentCleanupEndpoint);
  app.use('/api/functions', require('./server/middleware/adminActivityEndpoint.js').adminActivityEndpoint);
  app.use('/api/functions', require('./server/routes/functions.js'));
  app.use('/api/ai', require('./server/routes/ai.js'));
  app.use('/api/bookmarks', require('./server/routes/bookmarks.js'));

  try {
    require('./server/services/cronService.js').start();
    require('./server/services/imageRepairService.js').startImageRepairScheduler();
  } catch (cronErr) { console.warn('[DealScout] Scheduler initialization warning:', cronErr.message); }

  // Keep the public health check intentionally minimal. Operational/provider/storage
  // diagnostics belong behind authenticated admin endpoints, not in a public probe.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');
    app.use(express.static(distPath, { index: false }));
    app.use(async (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      try {
        let html = fs.readFileSync(indexPath, 'utf8');
        const baseUrl = seo.siteBase(req, configuredOrigin);
        let meta = seo.homeMeta(baseUrl);
        const dealMatch = req.path.match(/^\/deal\/([^/]+)$/);
        const categoryMatch = req.path.match(/^\/category\/([^/]+)$/);
        if (req.path.startsWith('/admin')) {
          meta = { ...seo.homeMeta(baseUrl), title: 'DealScout Admin', description: 'Private DealScout administration.', canonical: null, robots: 'noindex,nofollow' };
        } else if (dealMatch) {
          const deal = await dealRepository.findByIdOrAsin(decodeURIComponent(dealMatch[1]));
          if (deal && deal.status === 'APPROVED' && deal.source_verified === 1 && deal.is_expired !== 1) meta = seo.dealMeta(baseUrl, deal);
        } else if (categoryMatch) {
          const rows = await categoryRepository.list({ slug: decodeURIComponent(categoryMatch[1]) });
          if (rows[0]) meta = seo.categoryMeta(baseUrl, rows[0]);
        } else if (req.path === '/disclosure') {
          meta = { title: 'Affiliate Disclosure — DealScout', description: 'How DealScout uses Amazon affiliate links and how deal pricing is presented.', canonical: `${baseUrl}/disclosure` };
        } else if (req.path === '/saved') {
          meta = { ...seo.homeMeta(baseUrl), title: 'Saved Deals — DealScout', description: 'Your saved DealScout deals.', canonical: null, robots: 'noindex,follow' };
        }
        res.type('html').send(seo.replaceMeta(html, meta));
      } catch (err) {
        console.warn('[DealScout] SEO render fallback:', err.message);
        res.sendFile(indexPath);
      }
    });
  }

  app.use((req, res, next) => { if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' }); next(); });
  app.use((err, req, res, _next) => {
    console.error('[DealScout] Unhandled request error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, '0.0.0.0', () => console.log(`[DealScout] Server running on port ${PORT}`));
}

startServer().catch((err) => { console.error('[DealScout] Failed to start server:', err); process.exit(1); });
