import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const isProduction = process.env.NODE_ENV === 'production';

  const postgres = require('./server/storage/postgres.js');
  const runtimeBootstrap = require('./server/startup/runtimeBootstrap.js');
  const dealRepository = require('./server/repositories/dealRepository.js');
  const sitemapRepository = require('./server/repositories/sitemapRepository.js');
  const categoryRepository = require('./server/repositories/categoryRepository.js');
  const seo = require('./server/services/seoService.js');
  const dealCron = require('./server/services/cronService.js');
  const { resolveTrustProxy } = require('./server/config/trustProxy.js');
  const { resolvePublicWebUrl, resolveCorsOrigins, createCorsOriginPolicy } = require('./server/config/publicSurface.js');
  const { buildShopperApi } = require('./server/routes/shopperApi.js');
  const publicWebUrl = resolvePublicWebUrl(process.env, { isProduction });
  const corsOrigins = resolveCorsOrigins(process.env, { isProduction });

  await runtimeBootstrap.initializeRuntime({ isProduction });

  app.disable('x-powered-by');
  const trustProxy = resolveTrustProxy(process.env.TRUST_PROXY, { isProduction });
  if (trustProxy !== false) app.set('trust proxy', trustProxy);
  const { securityHeaders, apiRateLimit } = require('./server/middleware/securityBaseline.js');
  app.use(securityHeaders);
  app.use(require('./server/middleware/apiResponseContract.js').apiResponseContract);
  app.use(cors({ origin: createCorsOriginPolicy(corsOrigins, { isProduction }), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(apiRateLimit());

  const amazonContentPolicy = require('./server/middleware/amazonContentPolicy.js');
  app.use(amazonContentPolicy.blockThirdPartyAmazonReviews);
  app.use(amazonContentPolicy.strictRainforestSearch);
  app.use(require('./server/middleware/adminActivityAudit.js').adminActivityAudit);

  app.get('/robots.txt', (req, res) => res.type('text/plain').send(seo.buildRobots(seo.siteBase(req, publicWebUrl))));
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const [liveDeals, categories] = await Promise.all([
        sitemapRepository.listFreshPublicDeals({ maxAgeHours: 168 }),
        categoryRepository.list(),
      ]);
      res.type('application/xml').send(seo.buildSitemap({ baseUrl: seo.siteBase(req, publicWebUrl), deals: liveDeals, categories }));
    } catch (err) {
      console.warn('[DealScout] Sitemap generation failed:', err.message);
      res.status(503).type('text/plain').send('Sitemap temporarily unavailable');
    }
  });

  // v1 is the stable contract for shopper-facing web/mobile clients. The
  // unversioned mount remains a compatibility alias while existing clients
  // transition; both use the exact same route implementation and trust rules.
  app.use('/api/v1', buildShopperApi({ version: 1 }));
  app.use('/api', buildShopperApi());

  // Administrative and internal automation APIs are intentionally kept outside
  // the shopper compatibility contract and can evolve with the admin console.
  app.use('/api/editorial', require('./server/routes/editorial.js'));
  app.use('/api/functions', require('./server/middleware/imageRepairEndpoint.js').imageRepairEndpoint);
  app.use('/api/functions', require('./server/middleware/integrityHealthEndpoint.js').integrityHealthEndpoint);
  app.use('/api/functions', require('./server/middleware/legacyEnrichmentCleanupEndpoint.js').legacyEnrichmentCleanupEndpoint);
  app.use('/api/functions', require('./server/middleware/adminActivityEndpoint.js').adminActivityEndpoint);
  app.use('/api/functions', require('./server/middleware/publicationHealthEndpoint.js').publicationHealthEndpoint);
  app.use('/api/functions', require('./server/middleware/channelSettingsEndpoint.js').channelSettingsEndpoint);
  app.use('/api/functions', require('./server/routes/functions.js'));
  app.use('/api/ai', require('./server/routes/ai.js'));

  try {
    dealCron.start();
  } catch (cronErr) { console.warn('[DealScout] Scheduler initialization warning:', cronErr.message); }

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/api/ready', runtimeBootstrap.readinessEndpoint);

  let vite = null;
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
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
        const baseUrl = seo.siteBase(req, publicWebUrl);
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
