// ─── OAuth Integration Tests ────────────────────────────────────────
// Tests all four OAuth flows (Google, Facebook, GitHub, Discord)
// end-to-end through oauth.js → auth.js → SQLite.
//
// Run: node --test backend/oauth.test.js

const { describe, it, before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

// ── Setup env before requiring modules ──────────────────────────────
const TEST_DB = path.join(__dirname, "test_oauth.db");
process.env.JWT_SECRET = "test-secret-for-oauth-tests";

// We'll intercept https requests to avoid hitting real providers
const https = require("https");

// ── Helpers ─────────────────────────────────────────────────────────

function mockHttpsResponse(data, statusCode = 200) {
  const { EventEmitter } = require("events");
  const res = new EventEmitter();
  res.statusCode = statusCode;
  const req = new EventEmitter();
  req.end = () => {};
  req.write = () => {};

  // Simulate async response
  setTimeout(() => {
    res.emit("data", JSON.stringify(data));
    res.emit("end");
  }, 5);

  return { req, res };
}

// ── Shared state ────────────────────────────────────────────────────
let oauth;
let auth;

// ── Test suite ──────────────────────────────────────────────────────

describe("OAuth Integration Tests", () => {
  before(() => {
    // Clean up any leftover test DB
    try { fs.unlinkSync(TEST_DB); } catch (_) {}

    // Point auth module at test DB by patching DB_PATH before require
    // We override better-sqlite3's path via the auth module's internal ref
    // Since we can't easily intercept the path, we copy the prod db schema
    // by requiring auth which creates the DB, then we work with that.
    // Actually — auth.js hardcodes the path. We need a different approach:
    // set up the env and let it use the default DB path for testing.
    // For isolation, we'll just test the oauth module's parsing + auth
    // integration through oauthLoginOrRegister.

    // Configure all four providers
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    process.env.FACEBOOK_APP_ID = "test-facebook-app-id";
    process.env.FACEBOOK_APP_SECRET = "test-facebook-secret";
    process.env.GITHUB_CLIENT_ID = "test-github-client-id";
    process.env.GITHUB_CLIENT_SECRET = "test-github-secret";
    process.env.DISCORD_CLIENT_ID = "test-discord-client-id";
    process.env.DISCORD_CLIENT_SECRET = "test-discord-secret";

    oauth = require("./oauth");
    auth = require("./auth");
  });

  after(() => {
    try { fs.unlinkSync(TEST_DB); } catch (_) {}
  });

  // ── Provider discovery ──────────────────────────────────────────

  describe("getEnabledProviders()", () => {
    it("returns all four providers when configured", () => {
      const providers = oauth.getEnabledProviders();
      assert.deepStrictEqual(providers.sort(), [
        "discord",
        "facebook",
        "github",
        "google",
      ]);
    });

    it("returns config for each provider", () => {
      for (const name of ["google", "facebook", "github", "discord"]) {
        const cfg = oauth.getConfig(name);
        assert.ok(cfg, `Config missing for ${name}`);
        assert.ok(cfg.clientId, `clientId missing for ${name}`);
        assert.ok(cfg.clientSecret, `clientSecret missing for ${name}`);
      }
    });

    it("returns null for unknown provider", () => {
      assert.strictEqual(oauth.getConfig("twitter"), null);
    });
  });

  // ── Google OAuth ────────────────────────────────────────────────

  describe("Google OAuth flow", () => {
    it("verifies a valid Google id_token and returns profile", async () => {
      const originalGet = https.get;
      https.get = (_url, _opts, cb) => {
        const { req, res } = mockHttpsResponse({
          sub: "google-uid-123",
          email: "alice@gmail.com",
          name: "Alice",
          picture: "https://lh3.googleusercontent.com/alice",
          aud: "test-google-client-id",
        });
        if (typeof _opts === "function") {
          _opts(res);
        } else {
          cb(res);
        }
        return req;
      };

      try {
        const profile = await oauth.verifyGoogleToken("fake-id-token");
        assert.strictEqual(profile.providerId, "google-uid-123");
        assert.strictEqual(profile.email, "alice@gmail.com");
        assert.strictEqual(profile.name, "Alice");
        assert.ok(profile.picture);
      } finally {
        https.get = originalGet;
      }
    });

    it("rejects token with audience mismatch", async () => {
      const originalGet = https.get;
      https.get = (_url, _opts, cb) => {
        const { req, res } = mockHttpsResponse({
          sub: "google-uid-123",
          email: "alice@gmail.com",
          aud: "wrong-client-id",
        });
        if (typeof _opts === "function") _opts(res);
        else cb(res);
        return req;
      };

      try {
        await assert.rejects(
          () => oauth.verifyGoogleToken("bad-token"),
          { message: "Token audience mismatch" },
        );
      } finally {
        https.get = originalGet;
      }
    });

    it("creates a new user via oauthLoginOrRegister (Google)", () => {
      const result = auth.oauthLoginOrRegister("google", {
        providerId: "google-uid-456",
        email: "newgoogle@gmail.com",
        name: "GoogleUser",
        picture: "https://example.com/pic.jpg",
      });
      assert.ok(result.token, "Should return a JWT token");
      assert.ok(result.user, "Should return a user object");
      assert.strictEqual(result.user.displayName, "GoogleUser");
      assert.ok(
        result.user.connectedProviders.includes("google"),
        "Should have google in connected providers",
      );
    });

    it("returns existing user on second login with same provider id", () => {
      const result = auth.oauthLoginOrRegister("google", {
        providerId: "google-uid-456",
        email: "newgoogle@gmail.com",
        name: "GoogleUser",
        picture: null,
      });
      assert.ok(result.token);
      assert.strictEqual(result.user.displayName, "GoogleUser");
    });
  });

  // ── Facebook OAuth ──────────────────────────────────────────────

  describe("Facebook OAuth flow", () => {
    it("verifies a valid Facebook access token and returns profile", async () => {
      const originalGet = https.get;
      let callCount = 0;
      https.get = (_url, _opts, cb) => {
        callCount++;
        let data;
        if (callCount === 1) {
          // debug_token call
          data = { data: { is_valid: true, app_id: "test-facebook-app-id" } };
        } else {
          // user info call
          data = {
            id: "fb-uid-123",
            name: "Bob",
            email: "bob@gmail.com",
            picture: { data: { url: "https://fb.com/bob.jpg" } },
          };
        }
        const { req, res } = mockHttpsResponse(data);
        if (typeof _opts === "function") _opts(res);
        else cb(res);
        return req;
      };

      try {
        const profile = await oauth.verifyFacebookToken("fake-access-token");
        assert.strictEqual(profile.providerId, "fb-uid-123");
        assert.strictEqual(profile.email, "bob@gmail.com");
        assert.strictEqual(profile.name, "Bob");
      } finally {
        https.get = originalGet;
      }
    });

    it("rejects invalid Facebook token", async () => {
      const originalGet = https.get;
      https.get = (_url, _opts, cb) => {
        const { req, res } = mockHttpsResponse({
          data: { is_valid: false },
        });
        if (typeof _opts === "function") _opts(res);
        else cb(res);
        return req;
      };

      try {
        await assert.rejects(
          () => oauth.verifyFacebookToken("bad-token"),
          { message: "Invalid Facebook token" },
        );
      } finally {
        https.get = originalGet;
      }
    });

    it("creates a new user via oauthLoginOrRegister (Facebook)", () => {
      const result = auth.oauthLoginOrRegister("facebook", {
        providerId: "fb-uid-789",
        email: "fbuser@gmail.com",
        name: "FBUser",
        picture: "https://fb.com/pic.jpg",
      });
      assert.ok(result.token);
      assert.strictEqual(result.user.displayName, "FBUser");
      assert.ok(result.user.connectedProviders.includes("facebook"));
    });
  });

  // ── GitHub OAuth ────────────────────────────────────────────────

  describe("GitHub OAuth flow", () => {
    it("exchanges code for token and returns profile", async () => {
      const originalRequest = https.request;
      const originalGet = https.get;

      // Mock POST (token exchange)
      https.request = (_opts, cb) => {
        const { req, res } = mockHttpsResponse({
          access_token: "gh-token-abc",
          token_type: "bearer",
        });
        cb(res);
        return req;
      };

      let getCallCount = 0;
      https.get = (_url, _opts, cb) => {
        getCallCount++;
        let data;
        if (getCallCount === 1) {
          // /user call
          data = {
            id: 12345,
            login: "charlie",
            name: "Charlie",
            email: "charlie@gmail.com",
            avatar_url: "https://github.com/charlie.png",
          };
        } else {
          // /user/emails call (shouldn't be needed since email was provided)
          data = [{ email: "charlie@gmail.com", primary: true, verified: true }];
        }
        const { req, res } = mockHttpsResponse(data);
        if (typeof _opts === "function") _opts(res);
        else cb(res);
        return req;
      };

      try {
        const profile = await oauth.exchangeGitHubCode("fake-code");
        assert.strictEqual(profile.providerId, "12345");
        assert.strictEqual(profile.email, "charlie@gmail.com");
        assert.strictEqual(profile.name, "Charlie");
      } finally {
        https.request = originalRequest;
        https.get = originalGet;
      }
    });

    it("fetches email from /user/emails when user.email is null", async () => {
      const originalRequest = https.request;
      const originalGet = https.get;

      https.request = (_opts, cb) => {
        const { req, res } = mockHttpsResponse({
          access_token: "gh-token-xyz",
        });
        cb(res);
        return req;
      };

      let getCallCount = 0;
      https.get = (_url, _opts, cb) => {
        getCallCount++;
        let data;
        if (getCallCount === 1) {
          data = { id: 99999, login: "nomail", name: null, email: null, avatar_url: null };
        } else {
          data = [
            { email: "secondary@test.com", primary: false, verified: true },
            { email: "primary@test.com", primary: true, verified: true },
          ];
        }
        const { req, res } = mockHttpsResponse(data);
        if (typeof _opts === "function") _opts(res);
        else cb(res);
        return req;
      };

      try {
        const profile = await oauth.exchangeGitHubCode("code-2");
        assert.strictEqual(profile.email, "primary@test.com");
        assert.strictEqual(profile.name, "nomail"); // falls back to login
      } finally {
        https.request = originalRequest;
        https.get = originalGet;
      }
    });

    it("rejects on token exchange error", async () => {
      const originalRequest = https.request;
      https.request = (_opts, cb) => {
        const { req, res } = mockHttpsResponse({
          error: "bad_verification_code",
          error_description: "The code has expired",
        });
        cb(res);
        return req;
      };

      try {
        await assert.rejects(
          () => oauth.exchangeGitHubCode("expired-code"),
          { message: "The code has expired" },
        );
      } finally {
        https.request = originalRequest;
      }
    });

    it("creates a new user via oauthLoginOrRegister (GitHub)", () => {
      const result = auth.oauthLoginOrRegister("github", {
        providerId: "gh-uid-555",
        email: "ghuser@gmail.com",
        name: "GHUser",
        picture: "https://github.com/ghuser.png",
      });
      assert.ok(result.token);
      assert.strictEqual(result.user.displayName, "GHUser");
      assert.ok(result.user.connectedProviders.includes("github"));
    });
  });

  // ── Discord OAuth ──────────────────────────────────────────────

  describe("Discord OAuth flow", () => {
    it("exchanges code for token and returns profile", async () => {
      const originalRequest = https.request;
      const originalGet = https.get;

      https.request = (_opts, cb) => {
        const { req, res } = mockHttpsResponse({
          access_token: "discord-token-abc",
          token_type: "Bearer",
        });
        cb(res);
        return req;
      };

      https.get = (_url, _opts, cb) => {
        const { req, res } = mockHttpsResponse({
          id: "discord-uid-777",
          username: "dave",
          global_name: "Dave",
          email: "dave@gmail.com",
          avatar: "abc123",
        });
        if (typeof _opts === "function") _opts(res);
        else cb(res);
        return req;
      };

      try {
        const profile = await oauth.exchangeDiscordCode(
          "fake-code",
          "http://localhost:3000/api/auth/oauth/discord/callback",
        );
        assert.strictEqual(profile.providerId, "discord-uid-777");
        assert.strictEqual(profile.email, "dave@gmail.com");
        assert.strictEqual(profile.name, "Dave");
        assert.ok(profile.picture.includes("discord-uid-777"));
      } finally {
        https.request = originalRequest;
        https.get = originalGet;
      }
    });

    it("handles user with no avatar", async () => {
      const originalRequest = https.request;
      const originalGet = https.get;

      https.request = (_opts, cb) => {
        const { req, res } = mockHttpsResponse({ access_token: "token2" });
        cb(res);
        return req;
      };

      https.get = (_url, _opts, cb) => {
        const { req, res } = mockHttpsResponse({
          id: "discord-uid-888",
          username: "noavatar",
          global_name: null,
          email: null,
          avatar: null,
        });
        if (typeof _opts === "function") _opts(res);
        else cb(res);
        return req;
      };

      try {
        const profile = await oauth.exchangeDiscordCode("code2", "http://localhost:3000/cb");
        assert.strictEqual(profile.picture, null);
        assert.strictEqual(profile.name, "noavatar"); // falls back to username
      } finally {
        https.request = originalRequest;
        https.get = originalGet;
      }
    });

    it("rejects on token exchange error", async () => {
      const originalRequest = https.request;
      https.request = (_opts, cb) => {
        const { req, res } = mockHttpsResponse({
          error: "invalid_grant",
          error_description: "Invalid code",
        });
        cb(res);
        return req;
      };

      try {
        await assert.rejects(
          () => oauth.exchangeDiscordCode("bad-code", "http://localhost:3000/cb"),
          { message: "Invalid code" },
        );
      } finally {
        https.request = originalRequest;
      }
    });

    it("creates a new user via oauthLoginOrRegister (Discord)", () => {
      const result = auth.oauthLoginOrRegister("discord", {
        providerId: "discord-uid-999",
        email: "discorduser@gmail.com",
        name: "DiscordUser",
        picture: "https://cdn.discordapp.com/avatars/999/abc.png",
      });
      assert.ok(result.token);
      assert.strictEqual(result.user.displayName, "DiscordUser");
      assert.ok(result.user.connectedProviders.includes("discord"));
    });
  });

  // ── Cross-provider: email auto-linking ─────────────────────────

  describe("Cross-provider email auto-linking", () => {
    it("links a second provider to existing user by email match", () => {
      // ghuser@gmail.com was created via GitHub above
      const result = auth.oauthLoginOrRegister("discord", {
        providerId: "discord-link-test",
        email: "ghuser@gmail.com",
        name: "GHUser via Discord",
        picture: null,
      });
      assert.ok(result.token);
      // Should still have the original display name
      assert.strictEqual(result.user.displayName, "GHUser");
      // Should now have both providers
      assert.ok(result.user.connectedProviders.includes("github"));
      assert.ok(result.user.connectedProviders.includes("discord"));
    });
  });
});
