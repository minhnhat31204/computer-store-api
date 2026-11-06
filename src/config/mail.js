const nodemailer = require('nodemailer');

/**
 * Gửi email qua REST API (HTTPS) để ẩn hoàn toàn IP VPS trong email header.
 * Ưu tiên:
 * 1. Resend API (RESEND_API_KEY)
 * 2. Brevo API (BREVO_API_KEY)
 * 3. Fallback SMTP (Nodemailer) nếu chưa cấu hình REST API
 */
async function sendEmailMessage({ to, subject, text, html }) {
  const { RESEND_API_KEY, RESEND_FROM, BREVO_API_KEY, BREVO_SENDER_NAME, BREVO_SENDER_EMAIL } = process.env;

  // 1. Gửi qua Resend REST API (HTTPS - 100% ẩn IP VPS)
  if (RESEND_API_KEY) {
    const from = RESEND_FROM || 'DEVORA <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        ...(html ? { html } : {})
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Resend API error (${res.status}): ${data.message || JSON.stringify(data)}`);
    }
    return { provider: 'resend', id: data.id };
  }

  // 2. Gửi qua Brevo / Sendinblue REST API (HTTPS - 100% ẩn IP VPS)
  if (BREVO_API_KEY) {
    const senderName = BREVO_SENDER_NAME || 'DEVORA';
    const senderEmail = BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'manbshop2025@gmail.com';
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: (Array.isArray(to) ? to : [to]).map(e => ({ email: e })),
        subject,
        textContent: text,
        ...(html ? { htmlContent: html } : {})
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Brevo API error (${res.status}): ${data.message || JSON.stringify(data)}`);
    }
    return { provider: 'brevo', messageId: data.messageId };
  }

  // 3. Fallback SMTP (Nodemailer)
  const transporter = getTransporter();
  if (!transporter) {
    const error = new Error('Chưa cấu hình dịch vụ gửi Email (Cần cấu hình RESEND_API_KEY hoặc BREVO_API_KEY hoặc SMTP).');
    error.status = 503;
    throw error;
  }

  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    ...(html ? { html } : {})
  });
}

function getTransporter() {
  const { SMTP_USER, SMTP_PASS } = process.env;
  const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
  const SMTP_PORT = process.env.SMTP_PORT || '587';
  if (!SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_PORT) === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

module.exports = { sendEmailMessage, getTransporter };
