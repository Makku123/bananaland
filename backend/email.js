// ─── Email Service ──────────────────────────────────────────────────
const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "Monkey Business <noreply@example.com>";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const smtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendVerificationEmail(email, token) {
  const link = `${BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  if (!transporter) {
    console.log(`[email] SMTP not configured. Verification link for ${email}:\n  ${link}`);
    return;
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "Verify your Monkey Business account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="text-align:center">🐵 Welcome to Monkey Business!</h2>
        <p>Click the button below to verify your email address:</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${link}" style="background:#f5a623;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
            Verify Email
          </a>
        </p>
        <p style="color:#888;font-size:13px">If you didn't create an account, you can ignore this email. This link expires in 24 hours.</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail(email, token) {
  const link = `${BASE_URL}/?reset_token=${encodeURIComponent(token)}`;

  if (!transporter) {
    console.log(`[email] SMTP not configured. Password reset link for ${email}:\n  ${link}`);
    return;
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "Reset your Monkey Business password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="text-align:center">🐵 Password Reset</h2>
        <p>You requested a password reset. Click the button below to choose a new password:</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${link}" style="background:#f5a623;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
            Reset Password
          </a>
        </p>
        <p style="color:#888;font-size:13px">If you didn't request this, you can ignore this email. This link expires in 1 hour.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, smtpConfigured };
