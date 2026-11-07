require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('⚠️ CẢNH BÁO: JWT_SECRET chưa được cấu hình trong .env! Vui lòng đặt JWT_SECRET ngay để đảm bảo an toàn.');
}
const ACTIVE_SECRET = JWT_SECRET || 'devora_jwt_super_secure_secret_key_2026_huflit_cnpmnc';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Danh sách các khóa bí mật cũ để hỗ trợ các phiên làm việc đang đăng nhập không bị gián đoạn
const LEGACY_SECRETS = [
  'devora_jwt_super_secure_secret_key_2026_huflit_cnpmnc',
  'super_secret_key_devora_store_2026_mssql_express',
  'fallback_devora_secret_key_super_safe_2026_xyz'
];

/**
 * Tạo token JWT từ thông tin user
 * @param {object} user - User instance hoặc plain object
 * @returns {string} token
 */
function generateToken(user) {
  const plainUser = typeof user.toJSON === 'function' ? user.toJSON() : user;
  const payload = {
    userId: plainUser.UserID,
    phone: plainUser.Phone || null,
    email: plainUser.Email || null,
    role: plainUser.Role || 'Customer',
    fullName: plainUser.FullName || '',
  };

  return jwt.sign(payload, ACTIVE_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Xác thực token JWT
 * Thử với ACTIVE_SECRET trước; nếu không khớp signature sẽ thử các khóa cũ trong thời gian chuyển tiếp
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, ACTIVE_SECRET);
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      for (const legacy of LEGACY_SECRETS) {
        if (legacy === ACTIVE_SECRET) continue;
        try {
          return jwt.verify(token, legacy);
        } catch {}
      }
    }
    throw err;
  }
}

module.exports = {
  JWT_SECRET: ACTIVE_SECRET,
  JWT_EXPIRES_IN,
  generateToken,
  verifyToken,
};
