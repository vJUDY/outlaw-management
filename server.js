/**
 * server.js
 * Outlaw RP — Secure Express Backend
 */

require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const helmet     = require('helmet');
const cors       = require('cors');
const path       = require('path');
const db         = require('./lib/db');

const authRouter  = require('./routes/auth');
const staffRouter = require('./routes/staff');
const adminRouter = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      scriptSrc:  ["'self'"],
      imgSrc:     ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Session ───────────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'CHANGE_ME_IN_PRODUCTION',
  resave: false,
  saveUninitialized: false,
  name: 'olrp.sid',
  cookie: {
    httpOnly: true,                                       // JS cannot read cookie
    secure: process.env.NODE_ENV === 'production',        // HTTPS only in prod
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,                          // 8 hours
  },
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', authRouter);
app.use('/api', staffRouter);
app.use('/api/admin', adminRouter);

// ── Serve frontend ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  // Hash admin password from env on startup
  const adminPwd = process.env.ADMIN_PASSWORD || 'admin2026';
  await db.seedAdmin(adminPwd);
  console.log('✓ Admin account seeded');

  // Try to pre-fetch sheet data and sync users
  try {
    const sheets = require('./lib/sheets');
    const data = await sheets.fetchSheetData();
    if (data.staff) {
      await db.syncFromSheet(data.staff);
      console.log(`✓ Synced ${data.staff.length} users from sheet`);
    }
  } catch (e) {
    console.warn('⚠ Initial sheet sync failed (will retry on first request):', e.message);
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 Outlaw RP server running on http://localhost:${PORT}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();
