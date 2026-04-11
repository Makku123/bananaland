#!/usr/bin/env node
// ─── One-time migration: users.json → SQLite ───────────────────────
//
// Reads legacy accounts from backend/users.json and inserts them into
// the SQLite database used by the new auth system.  After a successful
// run the JSON file is renamed to users.json.migrated so it won't be
// processed again.
//
// Usage:
//   node backend/migrate-users-json.js          (dry-run by default)
//   node backend/migrate-users-json.js --apply  (actually write to DB)

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const JSON_PATH = path.join(__dirname, "users.json");
const DB_PATH = path.join(__dirname, "bananaland.db");
const dryRun = !process.argv.includes("--apply");

// ── Preflight checks ────────────────────────────────────────────────

if (!fs.existsSync(JSON_PATH)) {
  console.log("No users.json found — nothing to migrate.");
  process.exit(0);
}

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET must be set in .env before running the migration.");
  process.exit(1);
}

// ── Read legacy data ────────────────────────────────────────────────

let legacyUsers;
try {
  const raw = fs.readFileSync(JSON_PATH, "utf-8");
  legacyUsers = JSON.parse(raw);
} catch (err) {
  console.error("Failed to parse users.json:", err.message);
  process.exit(1);
}

// Normalize: support both array and object-keyed formats
if (!Array.isArray(legacyUsers)) {
  legacyUsers = Object.values(legacyUsers);
}

if (legacyUsers.length === 0) {
  console.log("users.json is empty — nothing to migrate.");
  process.exit(0);
}

console.log(`Found ${legacyUsers.length} legacy account(s) in users.json.`);
if (dryRun) {
  console.log("DRY RUN — no changes will be written. Pass --apply to commit.\n");
}

// ── Open DB ─────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const findByEmail = db.prepare("SELECT id FROM users WHERE email = ?");
const insertUser = db.prepare(`
  INSERT INTO users (id, email, password, displayName, avatar, profilePicture, bio, createdAt)
  VALUES (@id, @email, @password, @displayName, @avatar, @profilePicture, @bio, @createdAt)
`);

// ── Migrate ─────────────────────────────────────────────────────────

const DEFAULT_AVATARS = [
  "\u{1F435}", "\u{1F412}", "\u{1F98D}", "\u{1F9A7}", "\u{1F438}",
  "\u{1F43B}", "\u{1F43C}", "\u{1F428}", "\u{1F981}", "\u{1F42F}",
  "\u{1F42E}", "\u{1F437}", "\u{1F430}", "\u{1F431}", "\u{1F436}",
];

let migrated = 0;
let skipped = 0;
let errors = 0;

const runMigration = db.transaction(() => {
  for (const legacy of legacyUsers) {
    const email = (legacy.email || "").trim().toLowerCase();
    const name = (legacy.displayName || legacy.name || legacy.username || "User").slice(0, 16);

    if (!email) {
      console.log(`  SKIP (no email): ${name}`);
      skipped++;
      continue;
    }

    // Skip if already exists in SQLite
    if (findByEmail.get(email)) {
      console.log(`  SKIP (exists):   ${email}`);
      skipped++;
      continue;
    }

    // Preserve original hashed password if present; otherwise generate placeholder
    let password = legacy.password || legacy.hashedPassword;
    if (!password) {
      password = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10);
    }

    const row = {
      id: legacy.id || crypto.randomBytes(8).toString("hex"),
      email,
      password,
      displayName: name,
      avatar: legacy.avatar || DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)],
      profilePicture: legacy.profilePicture || null,
      bio: (legacy.bio || "").slice(0, 200),
      createdAt: legacy.createdAt || Date.now(),
    };

    if (dryRun) {
      console.log(`  WOULD MIGRATE:   ${email} (${name})`);
    } else {
      try {
        insertUser.run(row);
        console.log(`  MIGRATED:        ${email} (${name})`);
      } catch (err) {
        console.error(`  ERROR:           ${email} — ${err.message}`);
        errors++;
        continue;
      }
    }
    migrated++;
  }
});

runMigration();

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\nDone. ${migrated} migrated, ${skipped} skipped, ${errors} errors.`);

if (!dryRun && errors === 0) {
  const dest = JSON_PATH + ".migrated";
  fs.renameSync(JSON_PATH, dest);
  console.log(`Renamed users.json → users.json.migrated`);
}

if (dryRun && migrated > 0) {
  console.log("\nRe-run with --apply to commit these changes.");
}

db.close();
