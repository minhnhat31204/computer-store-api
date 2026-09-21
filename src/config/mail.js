const nodemailer = require('nodemailer');

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: String(SMTP_PORT) === '465', auth: { user: SMTP_USER, pass: SMTP_PASS } });
}
module.exports = { getTransporter };
