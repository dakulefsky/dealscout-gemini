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
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  await getTransport().sendMail({
    from: config.from,
    to: email,
    subject: 'Reset your DealScout password',
    text: `Reset your DealScout password using this link: ${resetUrl}\n\nThis link expires in one hour.`,
  });
}

module.exports = { isConfigured, sendVerificationCode, sendPasswordReset };
