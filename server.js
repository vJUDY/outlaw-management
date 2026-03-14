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

// Trust Railway's reverse proxy
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:        ["'self'", "https://fonts.gstatic.com"],
      scriptSrc:      ["'self'", "'unsafe-inline'"],
      scriptSrcAttr:  ["'unsafe-inline'"],
      imgSrc:         ["'self'", "data:"],
      connectSrc:     ["'self'"],
    },
  },
}));

// CORS
const allowedOrigins = [
  'https://outlaw-management-production.up.railway.app',
  process.env.ALLOWED_ORIGIN,
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// Body parser
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'CHANGE_ME_IN_PRODUCTION',
  resave: false,
  saveUninitialized: false,
  name: 'olrp.sid',
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

// Routes
app.use('/', authRouter);
app.use('/api', staffRouter);
app.use('/api/admin', adminRouter);

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  // Seed admin — fast
  const adminPwd = process.env.ADMIN_PASSWORD || 'admin2026';
  await db.seedAdmin(adminPwd);
  console.log('✓ Admin account seeded');

  // Listen FIRST so Railway health check passes immediately
  app.listen(PORT, () => {
    console.log(`\n🚀 Outlaw RP server running on http://localhost:${PORT}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  });

  // Sync sheet in background — non-blocking
  setTimeout(async () => {
    try {
      const sheets = require('./lib/sheets');
      const data = await sheets.fetchSheetData();
      if (data.staff) {
        await db.syncFromSheet(data.staff);
        console.log(`✓ Synced ${data.staff.length} users from sheet`);
      }
    } catch (e) {
      console.warn('⚠ Sheet sync failed:', e.message);
    }
  }, 3000);
}

start();
