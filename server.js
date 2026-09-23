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

function applyScriptNonce(html, nonce) {
  if (!nonce) return html;
  const escapedNonce = escapeHtml(nonce);
  return html.replace(/<script(?![^>]*\snonce=)([^>]*)>/gi, `<script nonce="${escapedNonce}"$1>`);
}

function closureHtml(reason = 'Shabbat or Yom Tov') {
  const safeReason = escapeHtml(reason);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>DealScout — Closed for Shabbat</title>
  <style>
    :root{color-scheme:light;--ink:#173428;--paper:#f5f0e6;--muted:#6c736d;--rule:#b9b09f}
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--paper);color:var(--ink)}
    body{font-family:Arial,Helvetica,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}
    main{width:min(760px,100%);text-align:center;padding:52px 20px 44px;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
    .etching{width:154px;height:118px;margin:0 auto 28px;color:var(--ink);opacity:.88}
    h1{font-family:Georgia,'Times New Roman',serif;font-weight:600;font-size:clamp(38px,7vw,64px);line-height:.98;letter-spacing:-.035em;margin:0}
    p{max-width:520px;margin:20px auto 0;font-size:15px;line-height:1.7;color:var(--muted)}
    .small{font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-top:30px;color:#7d817c;font-weight:700}
  </style>
</head>
<body>
  <main>
    <svg class="etching" viewBox="0 0 180 138" role="img" aria-label="Shabbat candlesticks" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M55 112h70M68 112c8-8 11-21 11-38v-7h22v7c0 17 3 30 11 38"/>
        <path d="M74 67h32M77 62h26M81 57h18"/>
        <path d="M84 57c0-8-6-11-6-18 0-7 5-13 12-21 7 8 12 14 12 21 0 7-6 10-6 18"/>
        <path d="M89 52c-3-5-3-9 1-15 4 6 4 10 1 15"/>
        <path d="M48 117c13 4 27 5 42 5s29-1 42-5M61 124c19 5 39 6 58 0"/>
        <path d="M31 126c20 4 40 6 59 6 20 0 40-2 59-6" opacity=".55"/>
        <path d="M41 23c7 2 12 6 16 12M139 23c-7 2-12 6-16 12" opacity=".45"/>
      </g>
    </svg>
    <h1>Closed for Shabbat</h1>
    <p>DealScout pauses the public site during ${safeReason}. The deals will still be here when we reopen.</p>
    <div class="small">The site reopens automatically after the work-forbidden period</div>
  </main>
</body>
</html>`;
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

function categoryInitialContent(category, deals = []) {
  const name = escapeHtml(category.name || 'Deals');
  const description = escapeHtml(category.description || `Current ${name} deals and price drops.`);
  const count = Number(category.liveCount || 0);
  const dealLinks = (deals || []).slice(0, 12).map((deal) => {
    const title = escapeHtml(deal.title || 'Deal');
    const current = Number(deal.sale_price ?? deal.salePrice ?? 0);
    return `<li><a href="/deal/${encodeURIComponent(deal.id || deal.asin)}">${title}</a>${current > 0 ? ` — ${current.toFixed(2)}` : ''}</li>`;
  }).join('');
  return `<main data-server-crawl-content="category"><h1>${name} deals &amp; price drops</h1><p>${description}</p><p>${count} current ${count === 1 ? 'deal' : 'deals'} available.</p>${dealLinks ? `<section><h2>Current ${name} deals</h2><ul>${dealLinks}</ul></section>` : ''}<p><a href="/">Browse all current deals</a></p></main>`;
}

function homeInitialContent(categories = []) {
  const links = categories.map((category) => `<li><a href="/category/${encodeURIComponent(category.slug)}">${escapeHtml(category.name)}</a></li>`).join('');
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
  const dealFeedRepository = require('./server/repositories/dealFeedRepository.js');
  const { isPublicDeal } = require('./server/services/publicDealPolicy.js');
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
  app.use(require('./server/middleware/publicSurfaceOnly.js').publicSurfaceOnly);

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
      res.set('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600');
      res.type('application/xml').send(seo.buildSitemap({ baseUrl: seo.siteBase(req, publicWebUrl), deals: liveDeals, categories }));
    } catch (err) {
      console.warn('[DealScout] Sitemap generation failed:', err.message);
      res.status(503).type('text/plain').send('Sitemap temporarily unavailable');
    }
  });

  // On the public shopper service, Shabbat/Yom Tov is a true static closure:
  // no React shell and no shopper API execution. Crawler files and health probes
  // remain available; the private IAP admin service is unaffected.
  app.use(async (req, res, next) => {
    if (process.env.PUBLIC_SURFACE_ONLY !== 'true') return next();
    if (req.path === '/robots.txt' || req.path === '/sitemap.xml' || req.path === '/ads.txt' || req.path === '/api/health' || req.path === '/api/ready') return next();
    try {
      const closure = await jewishClosure.currentStatus();
      if (!closure.closed) return next();
      const retryAfter = '3600';
      res.set('Retry-After', retryAfter);
      res.set('Cache-Control', 'no-store');
      if (req.path.startsWith('/api/')) {
        return res.status(503).json({
          closed: true,
          reason: 'Shabbat or Yom Tov',
          message: 'DealScout is closed right now.',
        });
      }
      return res.status(503).type('html').send(closureHtml('Shabbat or Yom Tov'));
    } catch (error) {
      console.warn('[DealScout] Jewish closure calendar unavailable; failing closed:', error.message);
      res.set('Retry-After', '300');
      res.set('Cache-Control', 'no-store');
      if (req.path.startsWith('/api/')) {
        return res.status(503).json({
          closed: true,
          reason: 'Closure calendar unavailable',
          message: 'DealScout is temporarily unavailable.',
        });
      }
      return res.status(503).type('html').send(closureHtml('the Jewish closure calendar'));
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
    app.use(express.static(distPath, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));
    app.use(async (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
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
          if (deal && isPublicDeal(deal)) {
            meta = seo.dealMeta(baseUrl, deal);
            if (meta.robots !== 'noindex,follow') initialContent = dealInitialContent(deal);
          } else {
            status = 404;
            meta = { title: 'Deal not found — DealScout', description: 'This deal is no longer available.', canonical: null, robots: 'noindex,follow' };
          }
        } else if (categoryMatch) {
          const rows = await categoryRepository.list({ slug: decodeURIComponent(categoryMatch[1]), activeOnly: false });
          if (rows[0]) {
            let categoryDeals = [];
            try {
              const page = await dealFeedRepository.page({ category: rows[0].name, limit: 12, sort: 'discount_desc' });
              categoryDeals = page.items || [];
            } catch (error) {
              console.warn('[DealScout] Category crawl links unavailable:', error.message);
            }
            meta = seo.categoryMeta(baseUrl, rows[0], categoryDeals);
            initialContent = categoryInitialContent(rows[0], categoryDeals);
          } else {
            status = 404;
            meta = { title: 'Category not found — DealScout', description: 'This deal category is not currently available.', canonical: null, robots: 'noindex,follow' };
          }
        } else if (req.path === '/') {
          const categories = await categoryRepository.list({ activeOnly: true });
          meta = seo.homeMeta(baseUrl, categories);
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
        const nonceReady = applyScriptNonce(rendered, res.locals.cspNonce);
        res.status(status).type('html').send(injectInitialContent(nonceReady, initialContent));
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