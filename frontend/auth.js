// ─── Auth Client ────────────────────────────────────────────────────

const AUTH_TOKEN_KEY = "banana_auth_token";
const AUTH_USER_KEY = "banana_auth_user";

let currentUser = null;

// ── API helpers ────────────────────────────────────────────────────

async function authFetch(url, options = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(url, { ...options, headers });
  return res.json();
}

// ── Auth actions ───────────────────────────────────────────────────

async function authRegister() {
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const displayName = document.getElementById("register-name").value.trim();
  const errorEl = document.getElementById("register-error");
  errorEl.textContent = "";

  if (!email) return (errorEl.textContent = "Email is required.");
  if (!email.toLowerCase().endsWith("@gmail.com"))
    return (errorEl.textContent = "Only Gmail addresses are supported.");
  if (!password || password.length < 6)
    return (errorEl.textContent = "Password must be at least 6 characters.");

  const data = await authFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });

  if (data.error) return (errorEl.textContent = data.error);

  localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  currentUser = data.user;
  onAuthSuccess();
}

async function authLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";

  if (!email || !password)
    return (errorEl.textContent = "Email and password are required.");

  const data = await authFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (data.error) return (errorEl.textContent = data.error);

  localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  currentUser = data.user;
  onAuthSuccess();
}

function authLogout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  currentUser = null;
  updateMenuForAuth();
  showScreen("screen-menu");
}

async function authCheckSession() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    currentUser = null;
    return;
  }
  const data = await authFetch("/api/auth/profile");
  if (data.error) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    currentUser = null;
    return;
  }
  currentUser = data.user;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
}

function continueAsGuest() {
  currentUser = null;
  showScreen("screen-menu");
  updateMenuForAuth();
}

// ── After successful login/register ────────────────────────────────

function onAuthSuccess() {
  updateMenuForAuth();
  showScreen("screen-menu");

  // Auto-fill name fields
  if (currentUser) {
    const createName = document.getElementById("create-name");
    const joinName = document.getElementById("join-name");
    if (createName && !createName.value)
      createName.value = currentUser.displayName;
    if (joinName && !joinName.value) joinName.value = currentUser.displayName;
  }

  // Authenticate socket connection
  if (socket) {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) socket.emit("auth_socket", { token });
  }
}

// ── Update menu to show auth state ─────────────────────────────────

function updateMenuForAuth() {
  const profileBtn = document.getElementById("menu-profile-btn");
  const authBtns = document.getElementById("menu-auth-btns");
  const welcomeEl = document.getElementById("menu-welcome");

  if (currentUser) {
    profileBtn.style.display = "";
    authBtns.style.display = "none";
    welcomeEl.innerHTML =
      '<span class="menu-avatar">' +
      currentUser.avatar +
      "</span> " +
      escapeHtml(currentUser.displayName);
    welcomeEl.style.display = "";

    // Auto-fill name fields
    const createName = document.getElementById("create-name");
    const joinName = document.getElementById("join-name");
    if (createName && !createName.value)
      createName.value = currentUser.displayName;
    if (joinName && !joinName.value) joinName.value = currentUser.displayName;
  } else {
    profileBtn.style.display = "none";
    authBtns.style.display = "";
    welcomeEl.style.display = "none";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Profile screen ─────────────────────────────────────────────────

function showProfile() {
  if (!currentUser) return showScreen("screen-auth");
  showScreen("screen-profile");
  renderProfile();
  // Refresh from server for latest stats
  authFetch("/api/auth/profile").then((data) => {
    if (!data.error && data.user) {
      currentUser = data.user;
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      renderProfile();
    }
  });
}

function renderProfile() {
  if (!currentUser) return;

  document.getElementById("profile-avatar-display").textContent =
    currentUser.avatar;
  document.getElementById("profile-display-name").textContent =
    currentUser.displayName;
  document.getElementById("profile-email").textContent = currentUser.email;
  document.getElementById("profile-joined").textContent =
    "Joined " + new Date(currentUser.createdAt).toLocaleDateString();

  // Stats
  const s = currentUser.stats || {};
  document.getElementById("stat-games-played").textContent = s.gamesPlayed || 0;
  document.getElementById("stat-games-won").textContent = s.gamesWon || 0;
  document.getElementById("stat-win-rate").textContent =
    s.gamesPlayed > 0
      ? Math.round((s.gamesWon / s.gamesPlayed) * 100) + "%"
      : "—";
  document.getElementById("stat-total-bananas").textContent = (
    s.totalBananas || 0
  ).toLocaleString();
  document.getElementById("stat-highest-bananas").textContent = (
    s.highestBananas || 0
  ).toLocaleString();
  document.getElementById("stat-farms-owned").textContent = s.farmsOwned || 0;
  document.getElementById("stat-auctions-won").textContent = s.auctionsWon || 0;
  document.getElementById("stat-games-lost").textContent = s.gamesLost || 0;
  document.getElementById("stat-karma").textContent = s.karma || 0;
}

async function saveProfileName() {
  const input = document.getElementById("edit-display-name");
  const name = input.value.trim();
  if (!name) return;

  const data = await authFetch("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ displayName: name }),
  });
  if (data.error) return alert(data.error);

  currentUser = data.user;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  renderProfile();
  closeProfileEdit();
  updateMenuForAuth();
}

function openProfileEdit() {
  document.getElementById("profile-edit-section").style.display = "";
  document.getElementById("edit-display-name").value = currentUser.displayName;
}

function closeProfileEdit() {
  document.getElementById("profile-edit-section").style.display = "none";
}

async function selectProfileAvatar(avatar) {
  const data = await authFetch("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ avatar }),
  });
  if (data.error) return;
  currentUser = data.user;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  renderProfile();
  updateMenuForAuth();
  closeAvatarPicker();
}

function openAvatarPicker() {
  const picker = document.getElementById("avatar-picker-grid");
  const avatars = [
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
  picker.innerHTML = avatars
    .map(
      (a) =>
        '<button class="avatar-pick-btn' +
        (a === currentUser.avatar ? " avatar-pick-selected" : "") +
        '" onclick="selectProfileAvatar(\'' +
        a +
        "')\">" +
        a +
        "</button>",
    )
    .join("");
  document.getElementById("avatar-picker-section").style.display = "";
}

function closeAvatarPicker() {
  document.getElementById("avatar-picker-section").style.display = "none";
}

// ── Auth screen toggle ─────────────────────────────────────────────

function showAuthLogin() {
  document.getElementById("auth-login-form").style.display = "";
  document.getElementById("auth-register-form").style.display = "none";
  document.getElementById("auth-tab-login").classList.add("auth-tab-active");
  document
    .getElementById("auth-tab-register")
    .classList.remove("auth-tab-active");
}

function showAuthRegister() {
  document.getElementById("auth-login-form").style.display = "none";
  document.getElementById("auth-register-form").style.display = "";
  document.getElementById("auth-tab-login").classList.remove("auth-tab-active");
  document.getElementById("auth-tab-register").classList.add("auth-tab-active");
}

// ── Init: check for existing session on page load ──────────────────

async function initAuth() {
  await authCheckSession();
  updateMenuForAuth();

  // If logged in, auto-fill name fields
  if (currentUser) {
    const createName = document.getElementById("create-name");
    const joinName = document.getElementById("join-name");
    if (createName) createName.value = currentUser.displayName;
    if (joinName) joinName.value = currentUser.displayName;
  }
}

// Run on load
document.addEventListener("DOMContentLoaded", () => {
  initAuth();
});
