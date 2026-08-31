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
  const postgres = require('./server/storage/postgres.js');
  const dealRepository = require('./server/repositories/dealRepository.js');
  const sitemapRepository = require('./server/repositories/sitemapRepository.js');
  const userRepository = require('./server/repositories/userRepository.js');
  const categoryRepository = require('./server/repositories/categoryRepository.js');
  const bookmarkRepository = require('./server/repositories/bookmarkRepository.js');
  const editorialRepository = require('./server/repositories/editorialRepository.js');
  const activityRepository = require('./server/repositories/activityRepository.js');
  const seo = require('./server/services/seoService.js');
  const dealCron = require('./server/services/cronService.js');
  const imageRepair = require('./server/services/imageRepairService.js');
  const { resolveTrustProxy } = require('./server/config/trustProxy.js');
  if (isProduction) hardenJsonUsers(db);

  await Promise.all([
    dealRepository.ensureSchema(), userRepository.ensureSchema(), categoryRepository.ensureSchema(),
    editorialRepository.ensureSchema(), activityRepository.ensureSchema(),
  ]);
  await bookmarkRepository.ensureSchema();
  if (isProduction) await dealRepository.hardenProduction();

  app.disable('x-powered-by');
  const trustProxy = resolveTrustProxy(process.env.TRUST_PROXY, { isProduction });
  if (trustProxy !== false) app.set('trust proxy', trustProxy);
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
      const [liveDeals, categories] = await Promise.all([
        sitemapRepository.listFreshPublicDeals({ maxAgeHours: 168 }),
        categoryRepository.list(),
      ]);
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
  app.use('/api/functions', require('./server/middleware/publicationHealthEndpoint.js').publicationHealthEndpoint);
  app.use('/api/functions', require('./server/routes/functions.js'));
  app.use('/api/ai', require('./server/routes/ai.js'));
  app.use('/api/bookmarks', require('./server/routes/bookmarks.js'));

  try {
    dealCron.start();
    imageRepair.startImageRepairScheduler();
  } catch (cronErr) { console.warn('[DealScout] Scheduler initialization warning:', cronErr.message); }

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  let vite = null;
  if (!isProduction) {
    vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');
    const indexTemplate = fs.readFileSync(indexPath, 'utf8');
    app.use(express.static(distPath, { index: false }));
    app.use(async (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      try {
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
        res.type('html').send(seo.replaceMeta(indexTemplate, { ...meta, nonce: res.locals.cspNonce }));
      } catch (err) {
        console.warn('[DealScout] SEO render fallback:', err.message);
        res.type('html').send(indexTemplate);
      }
    });
  }

  app.use((req, res, next) => { if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' }); next(); });
  app.use((err, req, res, _next) => {
    console.error('[DealScout] Unhandled request error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  });

  const httpServer = app.listen(PORT, '0.0.0.0', () => console.log(`[DealScout] Server running on port ${PORT}`));
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[DealScout] ${signal} received; shutting down cleanly`);

    const forceExit = setTimeout(() => {
      console.error('[DealScout] Graceful shutdown timed out; forcing exit');
      httpServer.closeAllConnections?.();
      process.exit(1);
    }, 10_000);
    forceExit.unref?.();

    dealCron.stop();
    imageRepair.stopImageRepairScheduler();

    try {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => error ? reject(error) : resolve());
      });
      if (vite) await vite.close();
      await postgres.closePool();
      clearTimeout(forceExit);
      console.log('[DealScout] Shutdown complete');
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExit);
      console.error('[DealScout] Shutdown failed:', error);
      process.exit(1);
    }
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[DealScout] Fatal startup error:', err);
  process.exit(1);
});
