/**
 * routes/auth.js
 * POST /login
 * POST /logout
 * GET  /api/me
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── Rate limiter: max 10 attempts per 15 min per IP ──────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// ── POST /login ──────────────────────────────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, password } = req.body;

    try {
      // Admin check
      if (name === 'ADMIN') {
        const ok = await db.verifyAdmin(password);
        if (!ok) return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });

        req.session.regenerate(err => {
          if (err) return res.status(500).json({ error: 'Session error' });
          req.session.user = { name: 'ADMIN', role: 'admin' };
          return res.json({ ok: true, role: 'admin', name: 'ADMIN' });
        });
        return;
      }

      // Staff check — name must start with OL
      if (!name.startsWith('OL')) {
        return res.status(401).json({ error: 'الاسم غير موجود' });
      }

      const ok = await db.verifyUser(name, password);
      if (!ok) return res.status(401).json({ error: 'الاسم أو كلمة المرور غير صحيحة' });

      req.session.regenerate(err => {
        if (err) return res.status(500).json({ error: 'Session error' });
        req.session.user = { name, role: 'staff' };
        return res.json({ ok: true, role: 'staff', name });
      });

    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── POST /logout ─────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// ── GET /api/me ───────────────────────────────────────────────────────────────
router.get('/api/me', requireAuth, (req, res) => {
  const { name, role } = req.session.user;
  res.json({ name, role });
});

module.exports = router;
