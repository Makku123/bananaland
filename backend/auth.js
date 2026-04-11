// ─── Auth Module (SQLite) ───────────────────────────────────────────
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "bananaland.db");
if (!process.env.JWT_SECRET) {
  console.error(
    "\n[FATAL] JWT_SECRET is not set in your environment.\n" +
    "  All sessions would be invalidated on every server restart.\n" +
    "  Add JWT_SECRET=<long random string> to your .env file and restart.\n"
  );
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
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
    profilePicture TEXT DEFAULT NULL,
    bio           TEXT NOT NULL DEFAULT '',
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

// Migrations for existing DBs
try { db.exec("ALTER TABLE users ADD COLUMN profilePicture TEXT DEFAULT NULL"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN emailVerified INTEGER NOT NULL DEFAULT 0"); } catch (_) {}

// Email verification tokens
db.exec(`
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token     TEXT PRIMARY KEY,
    userId    TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Password reset tokens
db.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token     TEXT PRIMARY KEY,
    userId    TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS oauth_accounts (
    id         TEXT PRIMARY KEY,
    userId     TEXT NOT NULL,
    provider   TEXT NOT NULL,
    providerId TEXT NOT NULL,
    email      TEXT,
    createdAt  INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, providerId)
  )
`);

// ── Prepared statements ──────────────────────────────────────────────

const stmts = {
  insertUser: db.prepare(`
    INSERT INTO users (id, email, password, displayName, avatar, profilePicture, bio, createdAt)
    VALUES (@id, @email, @password, @displayName, @avatar, @profilePicture, @bio, @createdAt)
  `),
  findByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  findById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  updateDisplayName: db.prepare(`UPDATE users SET displayName = ? WHERE id = ?`),
  updateAvatar: db.prepare(`UPDATE users SET avatar = ? WHERE id = ?`),
  updatePassword: db.prepare(`UPDATE users SET password = ? WHERE id = ?`),
  updateProfilePicture: db.prepare(`UPDATE users SET profilePicture = ? WHERE id = ?`),
  updateBio: db.prepare(`UPDATE users SET bio = ? WHERE id = ?`),
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
  // OAuth
  findOAuth: db.prepare(`SELECT * FROM oauth_accounts WHERE provider = ? AND providerId = ?`),
  insertOAuth: db.prepare(`
    INSERT INTO oauth_accounts (id, userId, provider, providerId, email, createdAt)
    VALUES (@id, @userId, @provider, @providerId, @email, @createdAt)
  `),
  findOAuthByUser: db.prepare(`SELECT provider, email, createdAt FROM oauth_accounts WHERE userId = ?`),
  // Email verification
  setEmailVerified: db.prepare(`UPDATE users SET emailVerified = 1 WHERE id = ?`),
  insertVerifyToken: db.prepare(`INSERT INTO email_verification_tokens (token, userId, expiresAt) VALUES (?, ?, ?)`),
  findVerifyToken: db.prepare(`SELECT * FROM email_verification_tokens WHERE token = ?`),
  deleteVerifyTokens: db.prepare(`DELETE FROM email_verification_tokens WHERE userId = ?`),
  // Password reset
  insertResetToken: db.prepare(`INSERT INTO password_reset_tokens (token, userId, expiresAt) VALUES (?, ?, ?)`),
  findResetToken: db.prepare(`SELECT * FROM password_reset_tokens WHERE token = ?`),
  deleteResetTokens: db.prepare(`DELETE FROM password_reset_tokens WHERE userId = ?`),
};

// ── Helpers ──────────────────────────────────────────────────────────

function isValidEmail(email) {
  if (typeof email !== "string") return false;
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/i.test(email.trim());
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

// Placeholder password for OAuth-only accounts (unguessable)
function oauthPlaceholderPassword() {
  return bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10);
}

function sanitizeUser(row) {
  if (!row) return null;
  const { password, ...safe } = row;
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
  delete safe.gamesPlayed;
  delete safe.gamesWon;
  delete safe.gamesLost;
  delete safe.totalBananas;
  delete safe.highestBananas;
  delete safe.farmsOwned;
  delete safe.auctionsWon;
  delete safe.karma;

  // Include connected OAuth providers
  safe.connectedProviders = stmts.findOAuthByUser.all(row.id).map((o) => o.provider);

  return safe;
}

// ── Auth operations ──────────────────────────────────────────────────

function register(email, password, displayName) {
  if (!isValidEmail(email)) {
    return { error: "Please enter a valid email address." };
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
    profilePicture: null,
    bio: "",
    createdAt: Date.now(),
  });

  // Create email verification token
  const verifyToken = crypto.randomBytes(32).toString("hex");
  stmts.insertVerifyToken.run(verifyToken, userId, Date.now() + 24 * 60 * 60 * 1000);

  return { needsVerification: true, verifyToken, email: cleanEmail };
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

  if (!user.emailVerified) {
    // Generate a fresh verification token so they can re-verify
    stmts.deleteVerifyTokens.run(user.id);
    const verifyToken = crypto.randomBytes(32).toString("hex");
    stmts.insertVerifyToken.run(verifyToken, user.id, Date.now() + 24 * 60 * 60 * 1000);
    return { error: "Please verify your email before logging in.", unverified: true, verifyToken, email: cleanEmail };
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

  if (updates.profilePicture !== undefined) {
    const pic = updates.profilePicture === null ? null : String(updates.profilePicture).trim().slice(0, 500);
    if (pic && !/^https?:\/\/.+/i.test(pic)) {
      return { error: "Profile picture must be a valid URL." };
    }
    stmts.updateProfilePicture.run(pic, user.id);
  }

  if (updates.bio !== undefined) {
    const bio = String(updates.bio).trim().slice(0, 200);
    stmts.updateBio.run(bio, user.id);
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

// ── OAuth login/register ─────────────────────────────────────────────

function oauthLoginOrRegister(provider, profile) {
  // Check if this OAuth account already linked
  const existing = stmts.findOAuth.get(provider, profile.providerId);
  if (existing) {
    const user = stmts.findById.get(existing.userId);
    if (!user) return { error: "Linked user not found." };

    // Update profile picture from provider if user doesn't have one
    if (!user.profilePicture && profile.picture) {
      stmts.updateProfilePicture.run(profile.picture, user.id);
    }

    // OAuth proves email ownership — auto-verify
    if (!user.emailVerified) {
      stmts.setEmailVerified.run(user.id);
    }

    const token = createToken(user.id);
    const fresh = stmts.findById.get(user.id);
    return { token, user: sanitizeUser(fresh) };
  }

  // Check if a user with the same email exists — auto-link
  let user = null;
  if (profile.email) {
    user = stmts.findByEmail.get(profile.email.trim().toLowerCase());
  }

  if (user) {
    // Link OAuth to existing account
    stmts.insertOAuth.run({
      id: generateUserId(),
      userId: user.id,
      provider,
      providerId: profile.providerId,
      email: profile.email,
      createdAt: Date.now(),
    });

    if (!user.profilePicture && profile.picture) {
      stmts.updateProfilePicture.run(profile.picture, user.id);
    }

    // OAuth proves email ownership — auto-verify
    if (!user.emailVerified) {
      stmts.setEmailVerified.run(user.id);
    }

    const token = createToken(user.id);
    const fresh = stmts.findById.get(user.id);
    return { token, user: sanitizeUser(fresh) };
  }

  // Create new user from OAuth profile
  const userId = generateUserId();
  const name = (profile.name || "User").slice(0, 16);
  const email = profile.email
    ? profile.email.trim().toLowerCase()
    : `${provider}_${profile.providerId}@oauth.local`;
  const avatar =
    DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];

  stmts.insertUser.run({
    id: userId,
    email,
    password: oauthPlaceholderPassword(),
    displayName: name,
    avatar,
    profilePicture: profile.picture || null,
    bio: "",
    createdAt: Date.now(),
  });

  stmts.insertOAuth.run({
    id: generateUserId(),
    userId,
    provider,
    providerId: profile.providerId,
    email: profile.email,
    createdAt: Date.now(),
  });

  // OAuth proves email ownership — auto-verify
  stmts.setEmailVerified.run(userId);

  const token = createToken(userId);
  const newUser = stmts.findById.get(userId);
  return { token, user: sanitizeUser(newUser) };
}

// ── Email verification ────────────────────────────────────────────

function verifyEmail(token) {
  const row = stmts.findVerifyToken.get(token);
  if (!row) return { error: "Invalid or expired verification link." };
  if (row.expiresAt < Date.now()) {
    stmts.deleteVerifyTokens.run(row.userId);
    return { error: "Verification link has expired. Please log in to receive a new one." };
  }

  stmts.setEmailVerified.run(row.userId);
  stmts.deleteVerifyTokens.run(row.userId);

  const user = stmts.findById.get(row.userId);
  if (!user) return { error: "User not found." };

  const authToken = createToken(user.id);
  return { token: authToken, user: sanitizeUser(user) };
}

// ── Password reset ───────────────────────────────────────────────

function requestPasswordReset(email) {
  if (!email) return { error: "Email is required." };
  const cleanEmail = email.trim().toLowerCase();
  const user = stmts.findByEmail.get(cleanEmail);

  // Always return success to avoid email enumeration
  if (!user) return { success: true };

  stmts.deleteResetTokens.run(user.id);
  const token = crypto.randomBytes(32).toString("hex");
  stmts.insertResetToken.run(token, user.id, Date.now() + 60 * 60 * 1000); // 1 hour

  return { success: true, resetToken: token, email: cleanEmail };
}

function resetPassword(token, newPassword) {
  if (!token || !newPassword) return { error: "Token and new password are required." };
  if (newPassword.length < 6) return { error: "Password must be at least 6 characters." };

  const row = stmts.findResetToken.get(token);
  if (!row) return { error: "Invalid or expired reset link." };
  if (row.expiresAt < Date.now()) {
    stmts.deleteResetTokens.run(row.userId);
    return { error: "Reset link has expired. Please request a new one." };
  }

  const hashedPw = bcrypt.hashSync(newPassword, 10);
  stmts.updatePassword.run(hashedPw, row.userId);
  stmts.deleteResetTokens.run(row.userId);

  // Also verify email if not yet verified (they proved ownership)
  stmts.setEmailVerified.run(row.userId);

  const user = stmts.findById.get(row.userId);
  if (!user) return { error: "User not found." };

  const authToken = createToken(user.id);
  return { token: authToken, user: sanitizeUser(user) };
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  updateStats,
  getUserByToken,
  oauthLoginOrRegister,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  DEFAULT_AVATARS,
};
