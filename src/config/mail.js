const nodemailer = require('nodemailer');

function getTransporter() {
  const { SMTP_USER, SMTP_PASS } = process.env;
  const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
  const SMTP_PORT = process.env.SMTP_PORT || '587';
  if (!SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: String(SMTP_PORT) === '465', auth: { user: SMTP_USER, pass: SMTP_PASS } });
}
module.exports = { getTransporter };

