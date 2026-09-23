const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.sms'), override: true });
const { promisify } = require('util');
const { getTransporter } = require('../config/mail');

const scrypt = promisify(crypto.scrypt);
const challenges = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function normalizePhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/[\s().-]/g, '');
  let normalized;
  if (/^0\d{9}$/.test(digits)) normalized = `+84${digits.slice(1)}`;
  else if (/^84\d{9}$/.test(digits)) normalized = `+${digits}`;
  else if (/^\+84\d{9}$/.test(digits)) normalized = digits;
  else throw Object.assign(new Error('Số điện thoại Việt Nam không hợp lệ.'), { status: 400 });
  return normalized;
}

function phoneLookupValues(value) {
  const normalized = normalizePhone(value);
  return [...new Set([normalized, `0${normalized.slice(3)}`, normalized.slice(1)])];
}

function otpDigest(code) {
  return crypto.createHash('sha256').update(String(code)).digest();
}

function issueChallenge(key) {
  const current = challenges.get(key);
  if (current && Date.now() - current.sentAt < OTP_RESEND_MS) {
    const error = new Error('Vui lòng đợi 60 giây trước khi gửi mã mới.');
    error.status = 429;
    throw error;
  }
  const code = String(crypto.randomInt(100000, 1000000));
  challenges.set(key, {
    digest: otpDigest(code),
    expiresAt: Date.now() + OTP_TTL_MS,
    sentAt: Date.now(),
    attempts: 0,
    verified: false,
  });
  return code;
}

function checkChallenge(key, code) {
  const record = challenges.get(key);
  if (!record || Date.now() > record.expiresAt || record.attempts >= OTP_MAX_ATTEMPTS) {
    challenges.delete(key);
    return null;
  }
  record.attempts += 1;
  const supplied = otpDigest(code);
  if (supplied.length !== record.digest.length || !crypto.timingSafeEqual(supplied, record.digest)) return null;
  record.verified = true;
  return record;
}

function getVerifiedChallenge(key) {
  const record = challenges.get(key);
  if (!record || !record.verified || Date.now() > record.expiresAt) {
    challenges.delete(key);
    return null;
  }
  return record;
}

function consumeChallenge(key) {
  challenges.delete(key);
}

async function sendSms(to, code) {
  const { SPEEDSMS_ACCESS_TOKEN, SPEEDSMS_TYPE = '4', SPEEDSMS_SENDER = 'Verify' } = process.env;
  if (!SPEEDSMS_ACCESS_TOKEN) {
    const error = new Error('SMS chưa được cấu hình. Hãy thêm SPEEDSMS_ACCESS_TOKEN vào .env.sms.');
    error.status = 503;
    throw error;
  }

  const params = new URLSearchParams({
    'access-token': SPEEDSMS_ACCESS_TOKEN,
    to: normalizePhone(to).slice(1),
    content: `[MANB SHOP] Ma xac thuc cua ban la ${code}. Ma co hieu luc trong 5 phut.`,
    type: SPEEDSMS_TYPE,
  });
  if (SPEEDSMS_SENDER) params.set('sender', SPEEDSMS_SENDER);

  let result;
  try {
    const response = await fetch(`https://api.speedsms.vn/index.php/sms/send?${params.toString()}`);
    result = await response.json();
    if (!response.ok || result?.status !== 'success' || String(result?.code) !== '00') {
      const error = new Error('SpeedSMS không gửi được mã xác thực. Kiểm tra API token, Brandname và số dư tài khoản.');
      error.status = 502;
      throw error;
    }
  } catch (cause) {
    if (cause.status) throw cause;
    const error = new Error('Không kết nối được SpeedSMS để gửi mã xác thực.');
    error.status = 502;
    throw error;
  }
}
async function sendEmail(to, code, subject) {
  const transporter = getTransporter();
  if (!transporter) {
    const error = new Error('Email OTP chưa được cấu hình SMTP.');
    error.status = 503;
    throw error;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text: `Ma xac thuc MANB SHOP cua ban la ${code}. Ma co hieu luc trong 5 phut.`,
  });
}

async function sendChallenge(key, send) {
  const code = issueChallenge(key);
  try {
    await send(code);
  } catch (error) {
    challenges.delete(key);
    throw error;
  }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(password), salt, 64);
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (!String(stored || '').startsWith('scrypt:')) {
    return { valid: String(password) === String(stored || ''), needsUpgrade: true };
  }
  const [, saltHex, keyHex] = String(stored).split(':');
  try {
    const expected = Buffer.from(keyHex, 'hex');
    const actual = await scrypt(String(password), Buffer.from(saltHex, 'hex'), expected.length);
    return { valid: actual.length === expected.length && crypto.timingSafeEqual(actual, expected), needsUpgrade: false };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}

module.exports = {
  normalizePhone, phoneLookupValues, issueChallenge, checkChallenge,
  getVerifiedChallenge, consumeChallenge, sendSms, sendEmail, sendChallenge,
  hashPassword, verifyPassword,
};





