// ─── Auth Client ────────────────────────────────────────────────────

const AUTH_TOKEN_KEY = "banana_auth_token";
const AUTH_USER_KEY = "banana_auth_user";

let currentUser = null;
let _oauthProviders = [];
let _googleClientId = null;
let _facebookAppId = null;

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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return (errorEl.textContent = "Please enter a valid email address.");
  if (!password || password.length < 6)
    return (errorEl.textContent = "Password must be at least 6 characters.");

  const data = await authFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });

  if (data.error) return (errorEl.textContent = data.error);

  if (data.needsVerification) {
    errorEl.textContent = "";
    showToast("Account created! Check your email to verify your account.", "success", 8000);
    showAuthLogin();
    return;
  }

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

  if (data.unverified) {
    errorEl.textContent = "";
    showToast("Please verify your email first. A new verification link has been sent.", "warning", 8000);
    return;
  }

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
  if (typeof socket !== "undefined" && socket) {
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
    if (currentUser.profilePicture) {
      welcomeEl.innerHTML =
        '<img class="menu-avatar-img" src="' +
        escapeHtml(currentUser.profilePicture) +
        '" alt="" /> ' +
        escapeHtml(currentUser.displayName);
    } else {
      welcomeEl.innerHTML =
        '<span class="menu-avatar">' +
        currentUser.avatar +
        "</span> " +
        escapeHtml(currentUser.displayName);
    }
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

  var skeleton = document.getElementById("profile-skeleton");
  var content = document.getElementById("profile-content");

  // If we have cached data, render immediately (no skeleton)
  if (currentUser.stats && currentUser.stats.gamesPlayed != null) {
    renderProfile();
  } else if (skeleton && content) {
    skeleton.style.display = "";
    content.style.display = "none";
  }

  // Refresh from server for latest stats
  authFetch("/api/auth/profile").then((data) => {
    if (skeleton) skeleton.style.display = "none";
    if (content) content.style.display = "";
    if (!data.error && data.user) {
      currentUser = data.user;
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      renderProfile();
    }
  });
}

function renderProfile() {
  if (!currentUser) return;

  // Avatar vs profile picture
  const emojiEl = document.getElementById("profile-avatar-display");
  const picEl = document.getElementById("profile-picture-display");
  if (currentUser.profilePicture) {
    emojiEl.style.display = "none";
    picEl.src = currentUser.profilePicture;
    picEl.style.display = "";
  } else {
    picEl.style.display = "none";
    emojiEl.style.display = "";
    emojiEl.textContent = currentUser.avatar;
  }

  document.getElementById("profile-display-name").textContent =
    currentUser.displayName;
  document.getElementById("profile-email").textContent = currentUser.email;
  document.getElementById("profile-joined").textContent =
    "Joined " + new Date(currentUser.createdAt).toLocaleDateString();

  // Bio
  const bioEl = document.getElementById("profile-bio-display");
  bioEl.textContent = currentUser.bio || "";
  bioEl.style.display = currentUser.bio ? "" : "none";

  // Connected accounts
  const providers = currentUser.connectedProviders || [];
  const connSection = document.getElementById("profile-connected-section");
  const connList = document.getElementById("connected-accounts-list");
  if (providers.length > 0) {
    connSection.style.display = "";
    const icons = { google: "Google", facebook: "Facebook", github: "GitHub", discord: "Discord" };
    connList.innerHTML = providers
      .map(
        (p) =>
          '<div class="connected-provider"><span class="connected-provider-dot connected-dot-' +
          p +
          '"></span>' +
          (icons[p] || p) +
          "</div>",
      )
      .join("");
  } else {
    connSection.style.display = "none";
  }

  // Stats
  const s = currentUser.stats || {};
  const hasPlayed = (s.gamesPlayed || 0) > 0;
  const emptyEl = document.getElementById("stats-empty");
  const gridEl = document.querySelector(".profile-stats-grid");
  if (emptyEl) emptyEl.style.display = hasPlayed ? "none" : "";
  if (gridEl) gridEl.style.display = hasPlayed ? "" : "none";
  document.getElementById("stat-games-played").textContent = s.gamesPlayed || 0;
  document.getElementById("stat-games-won").textContent = s.gamesWon || 0;
  document.getElementById("stat-win-rate").textContent =
    s.gamesPlayed > 0
      ? Math.round((s.gamesWon / s.gamesPlayed) * 100) + "%"
      : "\u2014";
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

// ── Profile edit: name ──────────────────────────────────────────────

async function saveProfileName() {
  const input = document.getElementById("edit-display-name");
  const name = input.value.trim();
  if (!name) return;

  const data = await authFetch("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ displayName: name }),
  });
  if (data.error) return showToast(data.error, "error");

  currentUser = data.user;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  renderProfile();
  closeProfileEdit();
  updateMenuForAuth();
  showToast("Display name updated.", "success");
}

function openProfileEdit() {
  document.getElementById("profile-edit-section").style.display = "";
  document.getElementById("edit-display-name").value = currentUser.displayName;
}

function closeProfileEdit() {
  document.getElementById("profile-edit-section").style.display = "none";
}

// ── Profile edit: bio ───────────────────────────────────────────────

function openBioEdit() {
  document.getElementById("profile-bio-edit-section").style.display = "";
  document.getElementById("edit-bio").value = currentUser.bio || "";
}

function closeBioEdit() {
  document.getElementById("profile-bio-edit-section").style.display = "none";
}

async function saveProfileBio() {
  const bio = document.getElementById("edit-bio").value.trim();
  const data = await authFetch("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ bio }),
  });
  if (data.error) return showToast(data.error, "error");

  currentUser = data.user;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  renderProfile();
  closeBioEdit();
  showToast("Bio updated.", "success");
}

// ── Profile edit: picture ───────────────────────────────────────────

function openProfilePicEdit() {
  document.getElementById("profile-pic-edit-section").style.display = "";
  document.getElementById("edit-profile-picture").value =
    currentUser.profilePicture || "";
}

function closeProfilePicEdit() {
  document.getElementById("profile-pic-edit-section").style.display = "none";
}

async function saveProfilePicture() {
  const url = document.getElementById("edit-profile-picture").value.trim();
  if (url && !/^https?:\/\/.+/i.test(url)) return showToast("Enter a valid URL.", "warning");

  const data = await authFetch("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ profilePicture: url || null }),
  });
  if (data.error) return showToast(data.error, "error");

  currentUser = data.user;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  renderProfile();
  closeProfilePicEdit();
  updateMenuForAuth();
  showToast("Profile picture updated.", "success");
}

async function removeProfilePicture() {
  const data = await authFetch("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ profilePicture: null }),
  });
  if (data.error) return showToast(data.error, "error");

  currentUser = data.user;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  renderProfile();
  closeProfilePicEdit();
  updateMenuForAuth();
}

// ── Avatar picker ───────────────────────────────────────────────────

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

// ── OAuth ───────────────────────────────────────────────────────────

async function loadOAuthProviders() {
  try {
    const data = await fetch("/api/auth/providers").then((r) => r.json());
    _oauthProviders = data.providers || [];
    _googleClientId = data.googleClientId || null;
    _facebookAppId = data.facebookAppId || null;
  } catch (_) {
    _oauthProviders = [];
  }

  if (_oauthProviders.length === 0) return;

  // Show the OAuth section
  document.getElementById("oauth-buttons").style.display = "";
  document.getElementById("oauth-divider").style.display = "";

  for (const p of _oauthProviders) {
    const btn = document.getElementById("oauth-" + p + "-btn");
    if (btn) btn.style.display = "";
  }

  // Dynamically load Google SDK
  if (_oauthProviders.includes("google") && _googleClientId) {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    document.head.appendChild(script);
  }

  // Dynamically load Facebook SDK
  if (_oauthProviders.includes("facebook") && _facebookAppId) {
    window.fbAsyncInit = function () {
      FB.init({ appId: _facebookAppId, cookie: true, xfbml: false, version: "v19.0" });
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }
}

function oauthGoogle() {
  if (!_googleClientId || typeof google === "undefined") return;
  google.accounts.id.initialize({
    client_id: _googleClientId,
    callback: async (response) => {
      const data = await authFetch("/api/auth/oauth/google", {
        method: "POST",
        body: JSON.stringify({ idToken: response.credential }),
      });
      if (data.error) return showToast(data.error, "error");
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      currentUser = data.user;
      onAuthSuccess();
    },
  });
  google.accounts.id.prompt((notification) => {
    // If one-tap is dismissed/skipped, fall back to button popup
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      google.accounts.oauth2
        .initCodeClient({
          client_id: _googleClientId,
          scope: "email profile",
          ux_mode: "popup",
          callback: () => {},
        });
      // Use the simpler popup approach
      const btn = document.createElement("div");
      btn.id = "_g_signin_tmp";
      btn.style.display = "none";
      document.body.appendChild(btn);
      google.accounts.id.renderButton(btn, { type: "standard" });
      btn.querySelector("div[role=button]")?.click();
      setTimeout(() => btn.remove(), 100);
    }
  });
}

function oauthFacebook() {
  if (typeof FB === "undefined") return;
  FB.login(
    async function (response) {
      if (response.status !== "connected") return;
      const data = await authFetch("/api/auth/oauth/facebook", {
        method: "POST",
        body: JSON.stringify({ accessToken: response.authResponse.accessToken }),
      });
      if (data.error) return showToast(data.error, "error");
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      currentUser = data.user;
      onAuthSuccess();
    },
    { scope: "email,public_profile" },
  );
}

function oauthGitHub() {
  window.location.href = "/api/auth/oauth/github";
}

function oauthDiscord() {
  window.location.href = "/api/auth/oauth/discord";
}

// Handle redirect-based OAuth callback (GitHub/Discord) + verification + reset
async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const authError = params.get("auth_error");
  const verified = params.get("verified");
  const verifyError = params.get("verify_error");
  const resetToken = params.get("reset_token");

  // Email verification error
  if (verifyError) {
    window.history.replaceState({}, "", window.location.pathname);
    showToast(verifyError, "error", 8000);
    return;
  }

  // Email verified successfully — auto-login with the provided token
  if (verified && token) {
    window.history.replaceState({}, "", window.location.pathname);
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    const data = await authFetch("/api/auth/profile");
    if (data.error) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      showToast("Verification succeeded but login failed: " + data.error, "error");
      return;
    }
    currentUser = data.user;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
    showToast("Email verified! You're now logged in.", "success");
    onAuthSuccess();
    return;
  }

  // Password reset link
  if (resetToken) {
    window.history.replaceState({}, "", window.location.pathname);
    showResetForm(resetToken);
    return;
  }

  if (authError) {
    window.history.replaceState({}, "", window.location.pathname);
    showToast("Authentication failed: " + authError, "error");
    return;
  }

  if (!token) return;

  // Clean URL
  window.history.replaceState({}, "", window.location.pathname);

  // Store token and fetch profile
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  const data = await authFetch("/api/auth/profile");
  if (data.error) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    showToast("Authentication failed: " + data.error, "error");
    return;
  }

  currentUser = data.user;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  onAuthSuccess();
}

// ── Auth screen toggle ─────────────────────────────────────────────

function showAuthLogin() {
  document.getElementById("auth-login-form").style.display = "";
  document.getElementById("auth-register-form").style.display = "none";
  document.getElementById("auth-forgot-form").style.display = "none";
  document.getElementById("auth-reset-form").style.display = "none";
  document.getElementById("auth-tab-login").classList.add("auth-tab-active");
  document
    .getElementById("auth-tab-register")
    .classList.remove("auth-tab-active");
}

function showAuthRegister() {
  document.getElementById("auth-login-form").style.display = "none";
  document.getElementById("auth-register-form").style.display = "";
  document.getElementById("auth-forgot-form").style.display = "none";
  document.getElementById("auth-reset-form").style.display = "none";
  document.getElementById("auth-tab-login").classList.remove("auth-tab-active");
  document.getElementById("auth-tab-register").classList.add("auth-tab-active");
}

// ── Forgot password ─────────────────────────────────────────────────

function showForgotPassword() {
  document.getElementById("auth-login-form").style.display = "none";
  document.getElementById("auth-register-form").style.display = "none";
  document.getElementById("auth-forgot-form").style.display = "";
  document.getElementById("auth-reset-form").style.display = "none";
  document.getElementById("auth-tab-login").classList.remove("auth-tab-active");
  document.getElementById("auth-tab-register").classList.remove("auth-tab-active");
  document.getElementById("forgot-error").textContent = "";
  document.getElementById("forgot-success").textContent = "";
}

async function authForgotPassword() {
  const email = document.getElementById("forgot-email").value.trim();
  const errorEl = document.getElementById("forgot-error");
  const successEl = document.getElementById("forgot-success");
  errorEl.textContent = "";
  successEl.textContent = "";

  if (!email) return (errorEl.textContent = "Email is required.");

  const data = await authFetch("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  if (data.error) return (errorEl.textContent = data.error);
  successEl.textContent = data.message || "If an account exists, a reset link has been sent.";
}

// ── Password reset (from email link) ────────────────────────────────

let _resetToken = null;

function showResetForm(token) {
  _resetToken = token;
  showScreen("screen-auth");
  document.getElementById("auth-login-form").style.display = "none";
  document.getElementById("auth-register-form").style.display = "none";
  document.getElementById("auth-forgot-form").style.display = "none";
  document.getElementById("auth-reset-form").style.display = "";
  document.getElementById("auth-tab-login").classList.remove("auth-tab-active");
  document.getElementById("auth-tab-register").classList.remove("auth-tab-active");
}

async function authResetPassword() {
  const password = document.getElementById("reset-password").value;
  const confirm = document.getElementById("reset-password-confirm").value;
  const errorEl = document.getElementById("reset-error");
  errorEl.textContent = "";

  if (!password || password.length < 6)
    return (errorEl.textContent = "Password must be at least 6 characters.");
  if (password !== confirm)
    return (errorEl.textContent = "Passwords do not match.");

  const data = await authFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: _resetToken, password }),
  });

  if (data.error) return (errorEl.textContent = data.error);

  localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  currentUser = data.user;
  _resetToken = null;
  showToast("Password reset successfully!", "success");
  onAuthSuccess();
}

// ── Init: check for existing session on page load ──────────────────

async function initAuth() {
  await handleOAuthCallback();
  await authCheckSession();
  await loadOAuthProviders();
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
