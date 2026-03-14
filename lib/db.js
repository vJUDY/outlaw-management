/**
 * lib/db.js
 * In-memory user store.
 * Replace with a real DB (SQLite / Postgres) when ready.
 * Passwords are always stored as bcrypt hashes.
 */

const bcrypt = require('bcrypt');
const ROUNDS = 12;

// users map: { [name]: { hash, role } }
// Populated/synced from Google Sheets + admin overrides
const users = new Map();

// Admin account lives separately, seeded from .env
let adminHash = null;

async function seedAdmin(plainPassword) {
  adminHash = await bcrypt.hash(plainPassword, ROUNDS);
}

/** Verify ADMIN login */
async function verifyAdmin(plain) {
  if (!adminHash) return false;
  return bcrypt.compare(plain, adminHash);
}

/** Upsert a staff user (called after sheet sync) */
async function upsertUser(name, plain, rank) {
  const existing = users.get(name);
  // Only re-hash if password actually changed
  if (existing && existing.plain === plain) {
    users.set(name, { ...existing, rank });
    return;
  }
  const hash = await bcrypt.hash(plain, ROUNDS);
  users.set(name, { hash, rank, plain }); // store plain temporarily for change-detection only
}

/** Verify a staff user */
async function verifyUser(name, plain) {
  const u = users.get(name);
  if (!u) return false;
  return bcrypt.compare(plain, u.hash);
}

/** Update a user's password (admin action) */
async function setPassword(name, plain) {
  const u = users.get(name);
  if (!u) throw new Error('User not found: ' + name);
  const hash = await bcrypt.hash(plain, ROUNDS);
  users.set(name, { ...u, hash, plain });
}

/** Update admin password */
async function setAdminPassword(plain) {
  adminHash = await bcrypt.hash(plain, ROUNDS);
}

/** Get all users as safe list (no hashes) */
function listUsers() {
  const result = [];
  for (const [name, { rank }] of users) {
    result.push({ name, rank });
  }
  return result;
}

/** Check if a user exists */
function userExists(name) {
  return users.has(name);
}

/** Sync users from sheet data (add new, keep existing passwords) */
async function syncFromSheet(staffArray) {
  for (const { name, rank } of staffArray) {
    if (!users.has(name)) {
      // New user — default password "1234"
      await upsertUser(name, '1234', rank);
    } else {
      // Existing user — just update rank
      const u = users.get(name);
      users.set(name, { ...u, rank });
    }
  }
}

module.exports = {
  seedAdmin,
  verifyAdmin,
  verifyUser,
  upsertUser,
  setPassword,
  setAdminPassword,
  listUsers,
  userExists,
  syncFromSheet,
};
