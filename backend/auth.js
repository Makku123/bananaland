// ─── Auth Module ────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "users.json");
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_EXPIRY = "30d";

const DEFAULT_AVATARS = [
  "🐵",
  "🐒",
  "🦍",
  "🦧",
  "🐸",
  "🐻",
  "🐼",
  "🐨",
  "🦁",
  "🐯",
  "🐮",
  "🐷",
  "🐰",
  "🐱",
  "🐶",
  "🐺",
  "🦊",
  "🐻‍❄️",
  "🐲",
  "🦄",
  "🐙",
  "🦋",
  "🐢",
  "🐠",
];

// ── File-based user store ──────────────────────────────────────────

function loadUsers() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch (_) {}
  return {};
}

function saveUsers(users) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), "utf8");
}

// ── Helpers ────────────────────────────────────────────────────────

function isValidGmail(email) {
  if (typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  // Basic email format check + gmail domain
  return /^[a-zA-Z0-9._%+\-]+@gmail\.com$/i.test(trimmed);
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

// ── Auth operations ────────────────────────────────────────────────

function register(email, password, displayName) {
  if (!isValidGmail(email)) {
    return { error: "Only Gmail addresses are supported for now." };
  }
  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = loadUsers();

  // Check if email already registered
  const existing = Object.values(users).find((u) => u.email === cleanEmail);
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

  users[userId] = {
    id: userId,
    email: cleanEmail,
    password: hashedPw,
    displayName: name,
    avatar: avatar,
    createdAt: Date.now(),
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      totalBananas: 0,
      highestBananas: 0,
      farmsOwned: 0,
      auctionsWon: 0,
    },
  };

  saveUsers(users);
  const token = createToken(userId);

  return {
    token,
    user: sanitizeUser(users[userId]),
  };
}

function login(email, password) {
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = loadUsers();

  const user = Object.values(users).find((u) => u.email === cleanEmail);
  if (!user) {
    return { error: "Invalid email or password." };
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return { error: "Invalid email or password." };
  }

  const token = createToken(user.id);
  return {
    token,
    user: sanitizeUser(user),
  };
}

function getProfile(token) {
  const payload = verifyToken(token);
  if (!payload) return { error: "Invalid or expired session." };

  const users = loadUsers();
  const user = users[payload.uid];
  if (!user) return { error: "User not found." };

  return { user: sanitizeUser(user) };
}

function updateProfile(token, updates) {
  const payload = verifyToken(token);
  if (!payload) return { error: "Invalid or expired session." };

  const users = loadUsers();
  const user = users[payload.uid];
  if (!user) return { error: "User not found." };

  if (updates.displayName !== undefined) {
    const name = String(updates.displayName).trim().slice(0, 16);
    if (name.length < 1)
      return { error: "Display name must be at least 1 character." };
    user.displayName = name;
  }

  if (updates.avatar !== undefined) {
    const av = String(updates.avatar).trim();
    if (av.length > 4) return { error: "Invalid avatar." };
    user.avatar = av;
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
    user.password = bcrypt.hashSync(updates.newPassword, 10);
  }

  saveUsers(users);
  return { user: sanitizeUser(user) };
}

function updateStats(userId, statUpdates) {
  const users = loadUsers();
  const user = users[userId];
  if (!user) return;

  const s = user.stats;
  if (statUpdates.gamesPlayed) s.gamesPlayed += statUpdates.gamesPlayed;
  if (statUpdates.gamesWon) s.gamesWon += statUpdates.gamesWon;
  if (statUpdates.bananasEarned) s.totalBananas += statUpdates.bananasEarned;
  if (statUpdates.highestBananas)
    s.highestBananas = Math.max(s.highestBananas, statUpdates.highestBananas);
  if (statUpdates.farmsOwned) s.farmsOwned += statUpdates.farmsOwned;
  if (statUpdates.auctionsWon) s.auctionsWon += statUpdates.auctionsWon;

  saveUsers(users);
}

function getUserByToken(token) {
  const payload = verifyToken(token);
  if (!payload) return null;
  const users = loadUsers();
  return users[payload.uid] || null;
}

// Strip password from user object before sending to client
function sanitizeUser(user) {
  const { password, ...safe } = user;
  return safe;
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
