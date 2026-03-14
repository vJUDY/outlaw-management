/**
 * lib/sheets.js
 * All Google Sheets / Apps Script communication lives here.
 * The URL and GID never leave the server.
 */

const fetch = require('node-fetch');

// Cache to avoid hammering the API
let cache = null;
let cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Current active GID (can be updated by admin) */
let currentGid = process.env.SHEET_GID || '43036446';

function getGid() { return currentGid; }
function setGid(gid) { currentGid = gid; invalidateCache(); }
function invalidateCache() { cache = null; cacheTs = 0; }

/**
 * Fetch data from the Apps Script web app.
 * Returns the parsed JSON result.
 */
async function fetchSheetData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cache && (now - cacheTs) < CACHE_TTL) {
    return cache;
  }

  const url = `${process.env.GSCRIPT_URL}?gid=${currentGid}&t=${now}`;
  const res = await fetch(url, { timeout: 15000 });

  if (!res.ok) {
    throw new Error(`Sheet fetch failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  cache = data;
  cacheTs = now;
  return data;
}

/**
 * Get a specific user's weekly data.
 */
function extractUserData(sheetData, username) {
  const weeks = [];
  for (let i = 1; i <= 5; i++) {
    const weekArr = sheetData[`week${i}`] || [];
    const row = weekArr.find(r => r.name === username);
    weeks.push(row || { pts:0, pulls:0, bonus:0, tickets:0, acc:0, rej:0, report:0 });
  }
  return {
    weekDates: sheetData.weekDates || [],
    weeks,
  };
}

/**
 * Build the full ranking (monthly totals).
 */
function buildRanking(sheetData) {
  const staff = sheetData.staff || [];
  return staff.map(s => {
    let total = 0;
    for (let i = 1; i <= 5; i++) {
      const row = (sheetData[`week${i}`] || []).find(r => r.name === s.name);
      if (row) total += row.pts || 0;
    }
    return { name: s.name, rank: s.rank, total };
  }).sort((a, b) => b.total - a.total);
}

module.exports = { fetchSheetData, extractUserData, buildRanking, getGid, setGid, invalidateCache };
