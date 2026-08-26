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
  const PORT = 3000;

  // Middlewares
  app.use(cors());
  app.use(express.json());

  // Backend API Routes
  app.use('/api/auth', require('./server/routes/auth.js'));
  app.use('/api/deals', require('./server/routes/deals.js'));
  app.use('/api/categories', require('./server/routes/categories.js'));
  app.use('/api/functions', require('./server/routes/functions.js'));
  app.use('/api/ai', require('./server/routes/ai.js'));
  app.use('/api/bookmarks', require('./server/routes/bookmarks.js'));

  // Start Automated Daily Deals Scheduler
  try {
    const dealCron = require('./server/services/cronService.js');
    dealCron.start();
  } catch (cronErr) {
    console.warn('[DealScout] Deal scheduler initialization warning:', cronErr.message);
  }

  // Health & Scheduler check endpoint
  app.get('/api/health', (_, res) => {
    let cronStatus = null;
    try {
      cronStatus = require('./server/services/cronService.js').getStatus();
    } catch {}
    res.json({ status: 'ok', time: new Date().toISOString(), scheduler: cronStatus });
  });

  // Vite Middleware for SPA serving in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DealScout] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[DealScout] Failed to start server:', err);
  process.exit(1);
});
