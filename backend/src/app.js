// The Express app: middleware and routes. server.js starts it; the tests use it directly.
import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { requireAdmin, requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import storeRoutes from './routes/store.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import { rulesRouter, settingsRouter } from './routes/pricing.js';
import { customersRouter, purchaseOrdersRouter, reportsRouter, suppliersRouter } from './routes/admin.js';

export const app = express();

// nginx (and Cloudflare in front of it) pass the visitor's IP in X-Forwarded-For.
app.set('trust proxy', config.trustProxy);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '100kb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => console.log(`${req.ip} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`));
    next();
  });
}

app.get('/', (req, res) => {
  res.json({ name: 'Bugasan ni Ali API', health: '/api/health' });
});

const api = Router();

// Generous overall limit; login and sign-up have a much stricter one (routes/auth.js).
api.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));

// Public
api.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
api.use('/auth', authRoutes);
api.use('/store', storeRoutes);

// Any logged-in user (each route checks admin-only actions itself)
api.use('/me', requireAuth, meRoutes);
api.use('/products', requireAuth, productRoutes);
api.use('/orders', requireAuth, orderRoutes);
api.use('/pricing-rules', requireAuth, rulesRouter);

// Store admin only
api.use('/settings', requireAuth, requireAdmin, settingsRouter);
api.use('/suppliers', requireAuth, requireAdmin, suppliersRouter);
api.use('/purchase-orders', requireAuth, requireAdmin, purchaseOrdersRouter);
api.use('/customers', requireAuth, requireAdmin, customersRouter);
api.use('/reports', requireAuth, requireAdmin, reportsRouter);

app.use('/api', api);
app.use(notFoundHandler);
app.use(errorHandler);
