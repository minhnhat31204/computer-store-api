const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.sms'), override: true });
const { promisify } = require('util');
const { getTransporter } = require('../config/mail');
const admin = require('firebase-admin');

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

function firebaseAuth() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw Object.assign(new Error('Backend chưa cấu hình FIREBASE_PROJECT_ID.'), { status: 503 });
  if (!admin.apps.length) {
    const options = { projectId };
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      let serviceAccount;
      try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); }
      catch { throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ.'), { status: 503 }); }
      options.credential = admin.credential.cert(serviceAccount);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const credentialPath = path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(__dirname, '../../', configuredPath);
      if (!fs.existsSync(credentialPath)) {
        throw Object.assign(new Error(`Không tìm thấy Firebase service account: ${credentialPath}`), { status: 503 });
      }
      let serviceAccount;
      try { serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf8')); }
      catch { throw Object.assign(new Error('Firebase service account không phải JSON hợp lệ.'), { status: 503 }); }
      if (serviceAccount.project_id && serviceAccount.project_id !== projectId) {
        throw Object.assign(new Error('Firebase service account thuộc project khác với FIREBASE_PROJECT_ID.'), { status: 503 });
      }
      options.credential = admin.credential.cert(serviceAccount);
    } else {
      options.credential = admin.credential.applicationDefault();
    }
    admin.initializeApp(options);
  }
  return admin.auth();
}

async function verifyFirebasePhoneToken(idToken, expectedPhone, options = {}) {
  if (!idToken) throw Object.assign(new Error('Thiếu xác nhận số điện thoại Firebase.'), { status: 400 });
  const token = String(idToken);
  if (token.split('.').length !== 3) {
    throw Object.assign(new Error('Firebase ID token nhận được không đúng định dạng. Hãy tải lại trang và xác minh OTP lại.'), { status: 400 });
  }
  let decoded;
  try { decoded = await firebaseAuth().verifyIdToken(token); }
  catch (error) {
    if (error.status) throw error;
    console.error('Firebase ID token verification failed:', error.stack || error.code || error.message);
    throw Object.assign(new Error('Xác nhận Firebase không hợp lệ hoặc đã hết hạn.'), { status: 401 });
  }
  if (options.maxAuthAgeSeconds && Date.now() / 1000 - Number(decoded.auth_time || 0) > options.maxAuthAgeSeconds) {
    throw Object.assign(new Error('Phiên xác thực số điện thoại đã cũ. Vui lòng xác thực lại bằng OTP.'), { status: 401 });
  }
  const phone = normalizePhone(decoded.phone_number || '');
  if (expectedPhone && phone !== normalizePhone(expectedPhone)) {
    throw Object.assign(new Error('Số điện thoại Firebase không khớp.'), { status: 403 });
  }
  return phone;
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
  getVerifiedChallenge, consumeChallenge, sendEmail, sendChallenge, verifyFirebasePhoneToken,
  hashPassword, verifyPassword,
};





