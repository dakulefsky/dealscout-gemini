import express from 'express';
import cors from 'cors';
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

  const db = require('./server/db.js');
  const dealRepository = require('./server/repositories/dealRepository.js');
  const userRepository = require('./server/repositories/userRepository.js');
  const categoryRepository = require('./server/repositories/categoryRepository.js');
  const bookmarkRepository = require('./server/repositories/bookmarkRepository.js');
  const editorialRepository = require('./server/repositories/editorialRepository.js');
  if (isProduction) hardenJsonUsers(db);

  await Promise.all([
    dealRepository.ensureSchema(),
    userRepository.ensureSchema(),
    categoryRepository.ensureSchema(),
    editorialRepository.ensureSchema(),
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

  app.use('/api/auth', require('./server/routes/auth.js'));
  app.use('/api/deals', require('./server/routes/priceHistory.js'));
  app.use('/api/deals', require('./server/middleware/verifiedAiIngestGuard.js').verifiedAiIngestGuard);
  app.use('/api/deals', require('./server/routes/deals.js'));
  app.use('/api/editorial', require('./server/routes/editorial.js'));
  app.use('/api/categories', require('./server/routes/categories.js'));
  app.use('/api/functions', require('./server/middleware/imageRepairEndpoint.js').imageRepairEndpoint);
  app.use('/api/functions', require('./server/middleware/integrityHealthEndpoint.js').integrityHealthEndpoint);
  app.use('/api/functions', require('./server/routes/functions.js'));
  app.use('/api/ai', require('./server/routes/ai.js'));
  app.use('/api/bookmarks', require('./server/routes/bookmarks.js'));

  try {
    require('./server/services/cronService.js').start();
    require('./server/services/imageRepairService.js').startImageRepairScheduler();
  } catch (cronErr) {
    console.warn('[DealScout] Scheduler initialization warning:', cronErr.message);
  }

  app.get('/api/health', async (_req, res) => {
    let cronStatus = null;
    try { cronStatus = await require('./server/services/cronService.js').getStatus(); } catch {}
    let priceHistoryStorage = { backend: 'unknown', healthy: false };
    try { priceHistoryStorage = await require('./server/services/priceHistoryService.js').health(); }
    catch (err) { priceHistoryStorage = { backend: process.env.DATABASE_URL ? 'postgres' : 'json', healthy: false, error: err.message }; }
    let postgres = { configured: false, healthy: false };
    try { postgres = await require('./server/storage/postgres.js').health(); }
    catch (err) { postgres = { configured: Boolean(process.env.DATABASE_URL), healthy: false, error: err.message }; }
    res.json({ status: 'ok', time: new Date().toISOString(), scheduler: cronStatus, storage: { postgres, priceHistory: priceHistoryStorage } });
  });

  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath, { index: false }));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
    next();
  });

  app.use((err, req, res, _next) => {
    console.error('[DealScout] Unhandled request error:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, '0.0.0.0', () => console.log(`[DealScout] Server running on port ${PORT}`));
}

startServer().catch((err) => {
  console.error('[DealScout] Failed to start server:', err);
  process.exit(1);
});
