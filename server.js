import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createServer as createViteServer } from 'vite';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigin = process.env.FRONTEND_URL;

  if (isProduction && !configuredOrigin) throw new Error('FRONTEND_URL must be configured in production');
  app.use(cors({ origin: configuredOrigin || true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', require('./server/routes/auth.js'));
  app.use('/api/deals', require('./server/routes/deals.js'));
  app.use('/api/categories', require('./server/routes/categories.js'));
  app.use('/api/functions', require('./server/routes/functions.js'));
  app.use('/api/ai', require('./server/routes/ai.js'));
  app.use('/api/bookmarks', require('./server/routes/bookmarks.js'));

  try {
    const dealCron = require('./server/services/cronService.js');
    dealCron.start();
  } catch (cronErr) { console.warn('[DealScout] Scheduler initialization warning:', cronErr.message); }

  app.get('/api/health', (_, res) => {
    let cronStatus = null;
    try { cronStatus = require('./server/services/cronService.js').getStatus(); } catch {}
    res.json({ status: 'ok', time: new Date().toISOString(), scheduler: cronStatus });
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