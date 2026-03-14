/**
 * routes/admin.js
 * GET  /api/admin/users          → list all users + ranks
 * POST /api/admin/password       → update one user's password
 * POST /api/admin/password/bulk  → randomize / bulk update passwords
 * POST /api/admin/password/admin → change admin password
 * GET  /api/admin/gid            → get current sheet GID
 * POST /api/admin/gid            → update sheet GID
 * POST /api/admin/sync           → force re-fetch from sheet
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAdmin } = require('../middleware/auth');
const db = require('../lib/db');
const sheets = require('../lib/sheets');

const router = express.Router();

// All routes in this file require admin
router.use(requireAdmin);

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    // Also refresh from sheet so new staff appear
    const sheetData = await sheets.fetchSheetData();
    if (sheetData.staff) await db.syncFromSheet(sheetData.staff);

    const users = db.listUsers();
    res.json({ users });
  } catch (err) {
    console.error('admin/users error:', err.message);
    res.status(502).json({ error: 'Failed to load users' });
  }
});

// ── POST /api/admin/password ──────────────────────────────────────────────────
router.post(
  '/password',
  [
    body('name').trim().notEmpty(),
    body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { name, password } = req.body;
    try {
      await db.setPassword(name, password);
      res.json({ ok: true });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }
);

// ── POST /api/admin/password/bulk ─────────────────────────────────────────────
// Body: { updates: [{ name, password }, ...] }
router.post('/password/bulk', async (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates) || !updates.length) {
    return res.status(400).json({ error: 'updates array required' });
  }

  const errors = [];
  for (const { name, password } of updates) {
    if (!name || !password || password.length < 4) {
      errors.push(name);
      continue;
    }
    try { await db.setPassword(name, password); }
    catch (e) { errors.push(name); }
  }

  res.json({ ok: true, failed: errors });
});

// ── POST /api/admin/password/admin ───────────────────────────────────────────
router.post(
  '/password/admin',
  [body('password').isLength({ min: 6 }).withMessage('Min 6 characters')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    await db.setAdminPassword(req.body.password);
    res.json({ ok: true });
  }
);

// ── GET /api/admin/gid ────────────────────────────────────────────────────────
router.get('/gid', (req, res) => {
  res.json({ gid: sheets.getGid() });
});

// ── POST /api/admin/gid ───────────────────────────────────────────────────────
router.post(
  '/gid',
  [body('gid').trim().notEmpty().withMessage('GID required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    sheets.setGid(req.body.gid);
    // Immediately pull fresh data
    try {
      const data = await sheets.fetchSheetData(true);
      if (data.staff) await db.syncFromSheet(data.staff);
      res.json({ ok: true, gid: req.body.gid });
    } catch (err) {
      res.status(502).json({ error: 'GID saved but sheet fetch failed: ' + err.message });
    }
  }
);

// ── POST /api/admin/sync ──────────────────────────────────────────────────────
router.post('/sync', async (req, res) => {
  try {
    const data = await sheets.fetchSheetData(true);
    if (data.staff) await db.syncFromSheet(data.staff);
    res.json({ ok: true, users: db.listUsers().length });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
