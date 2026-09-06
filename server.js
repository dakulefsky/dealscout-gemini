import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function injectInitialContent(html, content = '') {
  if (!content) return html;
  return html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
}

function closureHtml(reason = 'Shabbat or Yom Tov') {
  const safeReason = escapeHtml(reason);
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex,nofollow"/><title>DealScout is closed right now</title><style>body{margin:0;background:#f7f3e8;color:#17231b;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center}.box{max-width:620px;padding:48px 28px;text-align:center}h1{font-family:Georgia,serif;font-size:42px;margin:0 0 18px}p{font-size:17px;line-height:1.6;color:#536158}.small{font-size:13px;margin-top:28px;color:#7b837e}</style></head><body><main class="box"><div>✦</div><h1>We’re closed right now.</h1><p>DealScout pauses the shopper website during ${safeReason} according to the closure location selected in Admin. Please come back after the work-forbidden period ends.</p><p class="small">Shabbat &amp; Yom Tov closure calendar</p></main></body></html>`;
}

function dealInitialContent(deal) {
  const title = escapeHtml(deal.title || 'Amazon deal');
  const current = Number(deal.sale_price || 0);
  const original = Number(deal.original_price || 0);
  const savings = Math.max(0, original - current);
  const category = escapeHtml(deal.category || 'Deals');
  const image = deal.image_url ? `<img src="${escapeHtml(deal.image_url)}" alt="${title}" width="320" height="320" />` : '';
  const productUrl = deal.product_url ? `<p><a href="${escapeHtml(deal.product_url)}" rel="nofollow sponsored">View current deal on Amazon</a></p>` : '';
  return `<main data-server-crawl-content="deal"><article>${image}<p>${category}</p><h1>${title}</h1><p><strong>$${current.toFixed(2)}</strong>${original > current ? ` <del>$${original.toFixed(2)}</del>` : ''}</p>${savings > 0 ? `<p>Save $${savings.toFixed(2)} while this verified price is current.</p>` : ''}${productUrl}<p><a href="/">Browse more current deals</a></p></article></main>`;
}

function categoryInitialContent(category) {
  const name = escapeHtml(category.name || 'Deals');
  const description = escapeHtml(category.description || `Current ${name} deals and price drops.`);
  const count = Number(category.liveCount || 0);
  return `<main data-server-crawl-content="category"><h1>${name} deals &amp; price drops</h1><p>${description}</p><p>${count} current ${count === 1 ? 'deal' : 'deals'} available.</p><p><a href="/">Browse all current deals</a></p></main>`;
}

function homeInitialContent(categories = []) {
  const links = categories.slice(0, 12).map((category) => `<li><a href="/category/${encodeURIComponent(category.slug)}">${escapeHtml(category.name)}</a></li>`).join('');
  return `<main data-server-crawl-content="home"><h1>Amazon deals &amp; price drops worth checking</h1><p>DealScout surfaces current Amazon discounts with recently verified prices and clear savings.</p>${links ? `<nav aria-label="Deal categories"><h2>Browse current deal categories</h2><ul>${links}</ul></nav>` : ''}</main>`;
}

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
  const jewishClosure = require('./server/services/jewishClosureService.js');
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
        sitemapRepository.listFreshPublicDeals(),
        categoryRepository.list({ activeOnly: true }),
      ]);
      res.type('application/xml').send(seo.buildSitemap({ baseUrl: seo.siteBase(req, publicWebUrl), deals: liveDeals, categories }));
    } catch (err) {
      console.warn('[DealScout] Sitemap generation failed:', err.message);
      res.status(503).type('text/plain').send('Sitemap temporarily unavailable');
    }
  });

  app.use('/api/v1', buildShopperApi({ version: 1 }));
  app.use('/api', buildShopperApi());
  app.use('/api/editorial', require('./server/routes/editorial.js'));
  app.use('/api/functions', require('./server/middleware/imageRepairEndpoint.js').imageRepairEndpoint);
  app.use('/api/functions', require('./server/middleware/integrityHealthEndpoint.js').integrityHealthEndpoint);
  app.use('/api/functions', require('./server/middleware/legacyEnrichmentCleanupEndpoint.js').legacyEnrichmentCleanupEndpoint);
  app.use('/api/functions', require('./server/middleware/adminActivityEndpoint.js').adminActivityEndpoint);
  app.use('/api/functions', require('./server/middleware/publicationHealthEndpoint.js').publicationHealthEndpoint);
  app.use('/api/functions', require('./server/middleware/channelSettingsEndpoint.js').channelSettingsEndpoint);
  app.use('/api/functions', require('./server/middleware/jewishCalendarEndpoint.js').jewishCalendarEndpoint);
  app.use('/api/functions', require('./server/routes/functions.js'));
  app.use('/api/ai', require('./server/routes/ai.js'));

  try { dealCron.start(); } catch (cronErr) { console.warn('[DealScout] Scheduler initialization warning:', cronErr.message); }
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
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
      if (!req.path.startsWith('/admin')) {
        try {
          const closure = await jewishClosure.currentStatus();
          if (closure.closed) {
            res.set('Retry-After', '3600');
            return res.status(503).type('html').send(closureHtml('Shabbat or Yom Tov'));
          }
        } catch (error) {
          console.warn('[DealScout] Jewish closure calendar unavailable; failing closed:', error.message);
          res.set('Retry-After', '300');
          return res.status(503).type('html').send(closureHtml('the Jewish closure calendar'));
        }
      }
      try {
        const baseUrl = seo.siteBase(req, publicWebUrl);
        let meta = seo.homeMeta(baseUrl);
        let status = 200;
        let initialContent = '';
        const dealMatch = req.path.match(/^\/deal\/([^/]+)$/);
        const categoryMatch = req.path.match(/^\/category\/([^/]+)$/);
        if (req.path.startsWith('/admin')) {
          meta = { ...seo.homeMeta(baseUrl), title: 'DealScout Admin', description: 'Private DealScout administration.', canonical: null, robots: 'noindex,nofollow' };
        } else if (dealMatch) {
          const deal = await dealRepository.findByIdOrAsin(decodeURIComponent(dealMatch[1]));
          if (deal && deal.status === 'APPROVED' && deal.source_verified === 1 && deal.is_expired !== 1) {
            meta = seo.dealMeta(baseUrl, deal);
            if (meta.robots !== 'noindex,follow') initialContent = dealInitialContent(deal);
          } else {
            status = 404;
            meta = { title: 'Deal not found — DealScout', description: 'This deal is no longer available.', canonical: null, robots: 'noindex,follow' };
          }
        } else if (categoryMatch) {
          const rows = await categoryRepository.list({ slug: decodeURIComponent(categoryMatch[1]), activeOnly: true });
          if (rows[0]) {
            meta = seo.categoryMeta(baseUrl, rows[0]);
            initialContent = categoryInitialContent(rows[0]);
          } else {
            status = 404;
            meta = { title: 'Category not found — DealScout', description: 'This deal category is not currently available.', canonical: null, robots: 'noindex,follow' };
          }
        } else if (req.path === '/') {
          const categories = await categoryRepository.list({ activeOnly: true });
          initialContent = homeInitialContent(categories);
        } else if (req.path === '/disclosure') {
          meta = { title: 'Affiliate Disclosure — DealScout', description: 'How DealScout uses Amazon affiliate links and how deal pricing is presented.', canonical: `${baseUrl}/disclosure` };
        } else if (req.path === '/privacy') {
          meta = { title: 'Privacy Policy — DealScout', description: 'How DealScout uses guest identity, saved-deal, personalization, and service data.', canonical: `${baseUrl}/privacy` };
        } else if (req.path === '/support') {
          meta = { title: 'Support — DealScout', description: 'Help with DealScout prices, saved deals, links, and the mobile app.', canonical: `${baseUrl}/support` };
        } else if (req.path === '/saved') {
          meta = { ...seo.homeMeta(baseUrl), title: 'Saved Deals — DealScout', description: 'Your saved DealScout deals.', canonical: null, robots: 'noindex,follow' };
        } else {
          status = 404;
          meta = { title: 'Page not found — DealScout', description: 'The page you requested could not be found.', canonical: null, robots: 'noindex,follow' };
        }
        const rendered = seo.replaceMeta(indexTemplate, { ...meta, nonce: res.locals.cspNonce });
        res.status(status).type('html').send(injectInitialContent(rendered, initialContent));
      } catch (err) {
        console.warn('[DealScout] SEO render fallback:', err.message);
        res.status(503).type('html').send(indexTemplate);
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
    const forceExit = setTimeout(() => { console.error('[DealScout] Graceful shutdown timed out; forcing exit'); httpServer.closeAllConnections?.(); process.exit(1); }, 10_000);
    forceExit.unref?.();
    dealCron.stop();
    try {
      await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
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

startServer().catch((err) => { console.error('[DealScout] Fatal startup error:', err); process.exit(1); });