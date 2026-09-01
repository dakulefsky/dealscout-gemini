const nodemailer = require('nodemailer');
const { resolvePublicWebUrl } = require('../config/publicSurface');

function getConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user;
  return { host, port, user, pass, from, secure: process.env.SMTP_SECURE === 'true' || port === 465 };
}

function isConfigured() {
  const config = getConfig();
  return Boolean(config.host && config.port && config.user && config.pass && config.from);
}

function getTransport() {
  const config = getConfig();
  if (!isConfigured()) throw new Error('Email delivery is not configured');
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
}

async function sendVerificationCode(email, code) {
  const config = getConfig();
  await getTransport().sendMail({
    from: config.from,
    to: email,
    subject: 'Your DealScout verification code',
    text: `Your DealScout verification code is ${code}. It expires in 15 minutes.`,
  });
}

async function sendPasswordReset(email, rawToken) {
  const config = getConfig();
  const baseUrl = resolvePublicWebUrl(process.env, { isProduction: process.env.NODE_ENV === 'production' });
  if (!baseUrl) throw new Error('PUBLIC_WEB_URL is required for password reset email delivery');
  const resetUrl = `${baseUrl}/admin/reset-password?token=${encodeURIComponent(rawToken)}`;
  await getTransport().sendMail({
    from: config.from,
    to: email,
    subject: 'Reset your DealScout password',
    text: `Reset your DealScout password using this link: ${resetUrl}\n\nThis link expires in one hour.`,
  });
}

async function sendPriceAlert(email, { dealId, dealTitle, currentPrice, targetPrice }) {
  const config = getConfig();
  const baseUrl = resolvePublicWebUrl(process.env, { isProduction: process.env.NODE_ENV === 'production' });
  if (!baseUrl) throw new Error('PUBLIC_WEB_URL is required for price alert email delivery');
  const current = Number(currentPrice);
  const target = Number(targetPrice);
  if (!dealId || !Number.isFinite(current) || current <= 0 || !Number.isFinite(target) || target <= 0) {
    throw new Error('Valid deal and price values are required for price alert email delivery');
  }
  const dealUrl = `${baseUrl}/deal/${encodeURIComponent(dealId)}`;
  const title = String(dealTitle || 'A saved DealScout deal').trim();
  await getTransport().sendMail({
    from: config.from,
    to: email,
    subject: `DealScout price alert: $${current.toFixed(2)}`,
    text: `${title} is now $${current.toFixed(2)}, at or below your $${target.toFixed(2)} target.\n\nView the verified deal: ${dealUrl}\n\nPrice and availability can change on Amazon.`,
  });
}

module.exports = { isConfigured, sendVerificationCode, sendPasswordReset, sendPriceAlert };
