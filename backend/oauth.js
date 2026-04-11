// ─── OAuth Provider Module ──────────────────────────────────────────
const https = require("https");

const PROVIDERS = {
  google: {
    envId: "GOOGLE_CLIENT_ID",
    envSecret: "GOOGLE_CLIENT_SECRET",
  },
  facebook: {
    envId: "FACEBOOK_APP_ID",
    envSecret: "FACEBOOK_APP_SECRET",
  },
  github: {
    envId: "GITHUB_CLIENT_ID",
    envSecret: "GITHUB_CLIENT_SECRET",
  },
  discord: {
    envId: "DISCORD_CLIENT_ID",
    envSecret: "DISCORD_CLIENT_SECRET",
  },
};

function getEnabledProviders() {
  return Object.entries(PROVIDERS)
    .filter(([, cfg]) => process.env[cfg.envId])
    .map(([name]) => name);
}

function getConfig(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg) return null;
  return {
    clientId: process.env[cfg.envId] || "",
    clientSecret: process.env[cfg.envSecret] || "",
  };
}

// ── HTTP helpers ─────────────────────────────────────────────────────

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Invalid JSON from " + url));
        }
      });
    });
    req.on("error", reject);
  });
}

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const postData =
      typeof body === "string" ? body : JSON.stringify(body);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Length": Buffer.byteLength(postData),
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Invalid JSON from " + url));
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

// ── Google ────────────────────────────────────────────────────────────

async function verifyGoogleToken(idToken) {
  const cfg = getConfig("google");
  if (!cfg) throw new Error("Google OAuth not configured");

  const data = await httpsGet(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );

  if (data.error_description) throw new Error(data.error_description);
  if (data.aud !== cfg.clientId) throw new Error("Token audience mismatch");

  return {
    providerId: data.sub,
    email: data.email || null,
    name: data.name || data.email?.split("@")[0] || "User",
    picture: data.picture || null,
  };
}

// ── Facebook ─────────────────────────────────────────────────────────

async function verifyFacebookToken(accessToken) {
  const cfg = getConfig("facebook");
  if (!cfg) throw new Error("Facebook OAuth not configured");

  // Verify token belongs to our app
  const debug = await httpsGet(
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${cfg.clientId}|${cfg.clientSecret}`,
  );
  if (!debug.data || !debug.data.is_valid)
    throw new Error("Invalid Facebook token");

  // Get user info
  const user = await httpsGet(
    `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (user.error) throw new Error(user.error.message);

  return {
    providerId: user.id,
    email: user.email || null,
    name: user.name || "User",
    picture: user.picture?.data?.url || null,
  };
}

// ── GitHub ────────────────────────────────────────────────────────────

async function exchangeGitHubCode(code) {
  const cfg = getConfig("github");
  if (!cfg) throw new Error("GitHub OAuth not configured");

  const tokenData = await httpsPost(
    "https://github.com/login/oauth/access_token",
    JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
    }),
    {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  );

  if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);
  const accessToken = tokenData.access_token;

  const user = await httpsGet("https://api.github.com/user", {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "BananalandApp",
  });

  let email = user.email;
  if (!email) {
    const emails = await httpsGet("https://api.github.com/user/emails", {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "BananalandApp",
    });
    const primary = emails.find((e) => e.primary && e.verified);
    email = primary ? primary.email : emails[0]?.email || null;
  }

  return {
    providerId: String(user.id),
    email,
    name: user.name || user.login || "User",
    picture: user.avatar_url || null,
  };
}

// ── Discord ──────────────────────────────────────────────────────────

async function exchangeDiscordCode(code, redirectUri) {
  const cfg = getConfig("discord");
  if (!cfg) throw new Error("Discord OAuth not configured");

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  }).toString();

  const tokenData = await httpsPost(
    "https://discord.com/api/oauth2/token",
    params,
    { "Content-Type": "application/x-www-form-urlencoded" },
  );

  if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);
  const accessToken = tokenData.access_token;

  const user = await httpsGet("https://discord.com/api/users/@me", {
    Authorization: `Bearer ${accessToken}`,
  });
  if (user.code) throw new Error(user.message || "Discord API error");

  const avatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
    : null;

  return {
    providerId: String(user.id),
    email: user.email || null,
    name: user.global_name || user.username || "User",
    picture: avatar,
  };
}

module.exports = {
  getEnabledProviders,
  getConfig,
  verifyGoogleToken,
  verifyFacebookToken,
  exchangeGitHubCode,
  exchangeDiscordCode,
};
