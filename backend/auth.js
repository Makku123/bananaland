// ─── Auth Module (SQLite) ───────────────────────────────────────────
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "bananaland.db");
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_EXPIRY = "30d";

const DEFAULT_AVATARS = [
  "\u{1F435}",
  "\u{1F412}",
  "\u{1F98D}",
  "\u{1F9A7}",
  "\u{1F438}",
  "\u{1F43B}",
  "\u{1F43C}",
  "\u{1F428}",
  "\u{1F981}",
  "\u{1F42F}",
  "\u{1F42E}",
  "\u{1F437}",
  "\u{1F430}",
  "\u{1F431}",
  "\u{1F436}",
  "\u{1F43A}",
  "\u{1F98A}",
  "\u{1F43B}\u200D\u2744\uFE0F",
  "\u{1F432}",
  "\u{1F984}",
  "\u{1F419}",
  "\u{1F98B}",
  "\u{1F422}",
  "\u{1F420}",
];

// ── Database setup ───────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password      TEXT NOT NULL,
    displayName   TEXT NOT NULL,
    avatar        TEXT NOT NULL,
    createdAt     INTEGER NOT NULL,
    gamesPlayed   INTEGER NOT NULL DEFAULT 0,
    gamesWon      INTEGER NOT NULL DEFAULT 0,
    gamesLost     INTEGER NOT NULL DEFAULT 0,
    totalBananas  INTEGER NOT NULL DEFAULT 0,
    highestBananas INTEGER NOT NULL DEFAULT 0,
    farmsOwned    INTEGER NOT NULL DEFAULT 0,
    auctionsWon   INTEGER NOT NULL DEFAULT 0,
    karma         INTEGER NOT NULL DEFAULT 0
  )
`);

// ── Prepared statements ──────────────────────────────────────────────

const stmts = {
  insertUser: db.prepare(`
    INSERT INTO users (id, email, password, displayName, avatar, createdAt)
    VALUES (@id, @email, @password, @displayName, @avatar, @createdAt)
  `),
  findByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  findById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  updateDisplayName: db.prepare(`UPDATE users SET displayName = ? WHERE id = ?`),
  updateAvatar: db.prepare(`UPDATE users SET avatar = ? WHERE id = ?`),
  updatePassword: db.prepare(`UPDATE users SET password = ? WHERE id = ?`),
  updateStats: db.prepare(`
    UPDATE users SET
      gamesPlayed   = gamesPlayed   + @gamesPlayed,
      gamesWon      = gamesWon      + @gamesWon,
      gamesLost     = gamesLost     + @gamesLost,
      totalBananas  = totalBananas  + @bananasEarned,
      highestBananas = MAX(highestBananas, @highestBananas),
      farmsOwned    = farmsOwned    + @farmsOwned,
      auctionsWon   = auctionsWon   + @auctionsWon,
      karma         = karma         + @karma
    WHERE id = @id
  `),
};

// ── Helpers ──────────────────────────────────────────────────────────

function isValidGmail(email) {
  if (typeof email !== "string") return false;
  return /^[a-zA-Z0-9._%+\-]+@gmail\.com$/i.test(email.trim());
}

function generateUserId() {
  return crypto.randomBytes(8).toString("hex");
}

function createToken(userId) {
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
}

function sanitizeUser(row) {
  if (!row) return null;
  const { password, ...safe } = row;
  // Nest stats for backward-compat with frontend
  safe.stats = {
    gamesPlayed: row.gamesPlayed,
    gamesWon: row.gamesWon,
    gamesLost: row.gamesLost,
    totalBananas: row.totalBananas,
    highestBananas: row.highestBananas,
    farmsOwned: row.farmsOwned,
    auctionsWon: row.auctionsWon,
    karma: row.karma,
  };
  // Remove flat stat fields from top-level
  delete safe.gamesPlayed;
  delete safe.gamesWon;
  delete safe.gamesLost;
  delete safe.totalBananas;
  delete safe.highestBananas;
  delete safe.farmsOwned;
  delete safe.auctionsWon;
  delete safe.karma;
  return safe;
}

// ── Auth operations ──────────────────────────────────────────────────

function register(email, password, displayName) {
  if (!isValidGmail(email)) {
    return { error: "Only Gmail addresses are supported for now." };
  }
  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const cleanEmail = email.trim().toLowerCase();

  const existing = stmts.findByEmail.get(cleanEmail);
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const userId = generateUserId();
  const hashedPw = bcrypt.hashSync(password, 10);
  const name =
    (displayName || "").trim().slice(0, 16) ||
    cleanEmail.split("@")[0].slice(0, 16);
  const avatar =
    DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];

  stmts.insertUser.run({
    id: userId,
    email: cleanEmail,
    password: hashedPw,
    displayName: name,
    avatar: avatar,
    createdAt: Date.now(),
  });

  const token = createToken(userId);
  const user = stmts.findById.get(userId);

  return { token, user: sanitizeUser(user) };
}

function login(email, password) {
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = stmts.findByEmail.get(cleanEmail);
  if (!user) {
    return { error: "Invalid email or password." };
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return { error: "Invalid email or password." };
  }

  const token = createToken(user.id);
  return { token, user: sanitizeUser(user) };
}

function getProfile(token) {
  const payload = verifyToken(token);
  if (!payload) return { error: "Invalid or expired session." };

  const user = stmts.findById.get(payload.uid);
  if (!user) return { error: "User not found." };

  return { user: sanitizeUser(user) };
}

function updateProfile(token, updates) {
  const payload = verifyToken(token);
  if (!payload) return { error: "Invalid or expired session." };

  const user = stmts.findById.get(payload.uid);
  if (!user) return { error: "User not found." };

  if (updates.displayName !== undefined) {
    const name = String(updates.displayName).trim().slice(0, 16);
    if (name.length < 1)
      return { error: "Display name must be at least 1 character." };
    stmts.updateDisplayName.run(name, user.id);
  }

  if (updates.avatar !== undefined) {
    const av = String(updates.avatar).trim();
    if (av.length > 4) return { error: "Invalid avatar." };
    stmts.updateAvatar.run(av, user.id);
  }

  if (updates.newPassword !== undefined) {
    if (!updates.currentPassword) {
      return { error: "Current password is required to change password." };
    }
    if (!bcrypt.compareSync(updates.currentPassword, user.password)) {
      return { error: "Current password is incorrect." };
    }
    if (!updates.newPassword || updates.newPassword.length < 6) {
      return { error: "New password must be at least 6 characters." };
    }
    stmts.updatePassword.run(bcrypt.hashSync(updates.newPassword, 10), user.id);
  }

  const updated = stmts.findById.get(user.id);
  return { user: sanitizeUser(updated) };
}

function updateStats(userId, statUpdates) {
  const user = stmts.findById.get(userId);
  if (!user) return;

  stmts.updateStats.run({
    id: userId,
    gamesPlayed: statUpdates.gamesPlayed || 0,
    gamesWon: statUpdates.gamesWon || 0,
    gamesLost: statUpdates.gamesLost || 0,
    bananasEarned: statUpdates.bananasEarned || 0,
    highestBananas: statUpdates.highestBananas || 0,
    farmsOwned: statUpdates.farmsOwned || 0,
    auctionsWon: statUpdates.auctionsWon || 0,
    karma: statUpdates.karma || 0,
  });
}

function getUserByToken(token) {
  const payload = verifyToken(token);
  if (!payload) return null;
  return stmts.findById.get(payload.uid) || null;
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  updateStats,
  getUserByToken,
  DEFAULT_AVATARS,
};
