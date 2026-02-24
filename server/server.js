import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import Routes
import authRoutes from './routes/auth.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import adminRoutes from './routes/admin.routes.js';
import callbackRoutes from './routes/callback.routes.js';
import chatRoutes from './routes/chat.routes.js';
import pterodactylRoutes from './routes/pterodactyl.routes.js';

// Import Utils & DB
import { getSetting } from './database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// ============================
// MIDDLEWARE: Logger
// ============================
app.use((req, res, next) => {
  const start = Date.now();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.url.startsWith('/assets') && !req.url.endsWith('.js') && !req.url.endsWith('.css')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms) - IP: ${ip}`);
    }
  });
  next();
});

// ============================
// MIDDLEWARE: Maintenance Enforcement
// ============================
app.use((req, res, next) => {
  const isMaintenance = getSetting('maintenance_mode') === 'true';
  const isAuthLogin = req.url === '/api/auth/login';
  const isAdminPath = req.url.startsWith('/api/admin');
  const isPublicPath = ['/api/settings/maintenance', '/api/callback'].some(p => req.url.startsWith(p));

  if (isMaintenance && !isAuthLogin && !isAdminPath && !isPublicPath && req.url.startsWith('/api/')) {
    return res.status(503).json({ status: 'error', message: 'Sistem sedang dalam pemeliharaan (Maintenance).' });
  }
  next();
});

// ============================
// ROUTES
// ============================
app.use('/api/auth', authRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/callback', callbackRoutes);
app.use('/api/messages', chatRoutes);
app.use('/api/pterodactyl', pterodactylRoutes);

// Shared/Legacy Redirects (pointing to transaction routes)
app.get('/api/products', (req, res, next) => { req.url = '/products'; next(); }, transactionRoutes);
app.get('/api/deposit-methods', (req, res, next) => { req.url = '/deposit-methods'; next(); }, transactionRoutes);
app.post('/api/deposit/create', (req, res, next) => { req.url = '/deposit/create'; next(); }, transactionRoutes);
app.get('/api/deposit/:id/sync', (req, res, next) => { req.url = `/deposit/${req.params.id}/sync`; next(); }, transactionRoutes);
app.post('/api/deposit/cancel', (req, res, next) => { req.url = '/deposit/cancel'; next(); }, transactionRoutes);
app.post('/api/transaction/create', (req, res, next) => { req.url = '/transaction/create'; next(); }, transactionRoutes);

// Public Maintenance Status
app.get('/api/settings/maintenance', (req, res) => {
  const maintenance = getSetting('maintenance_mode') === 'true';
  res.json({ status: 'success', maintenance });
});

// ============================
// STATIC FILES & SPA FALLBACK
// ============================
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`=========================================`);
  console.log(`🚀 WANZZ PPOB SECURE SERVER v2.1 (REFECTORED)`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🛡️  Security: Rate Limited + Modular`);
  console.log(`=========================================`);
});
