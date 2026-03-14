/**
 * routes/staff.js
 * GET /api/me/data    → current user's weekly stats
 * GET /api/ranking    → full monthly ranking
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const sheets = require('../lib/sheets');
const db = require('../lib/db');

const router = express.Router();

// ── GET /api/me/data ─────────────────────────────────────────────────────────
router.get('/me/data', requireAuth, async (req, res) => {
  try {
    const sheetData = await sheets.fetchSheetData();

    // Sync any new users added to the sheet
    if (sheetData.staff) await db.syncFromSheet(sheetData.staff);

    const { name } = req.session.user;
    const userData = sheets.extractUserData(sheetData, name);

    // Find my rank from staff list
    const staffEntry = (sheetData.staff || []).find(s => s.name === name);

    res.json({
      name,
      rank: staffEntry?.rank || '',
      weekDates: userData.weekDates,
      weeks: userData.weeks,
    });
  } catch (err) {
    console.error('me/data error:', err.message);
    res.status(502).json({ error: 'Failed to fetch sheet data' });
  }
});

// ── GET /api/ranking ─────────────────────────────────────────────────────────
router.get('/ranking', requireAuth, async (req, res) => {
  try {
    const sheetData = await sheets.fetchSheetData();
    const ranking = sheets.buildRanking(sheetData);
    res.json({ ranking });
  } catch (err) {
    console.error('ranking error:', err.message);
    res.status(502).json({ error: 'Failed to fetch ranking' });
  }
});

module.exports = router;
