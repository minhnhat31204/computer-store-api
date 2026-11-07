const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('⚠️ CẢNH BÁO: JWT_SECRET chưa được cấu hình trong .env! Vui lòng đặt JWT_SECRET ngay để đảm bảo an toàn.');
}
const ACTIVE_SECRET = JWT_SECRET || 'devora_jwt_super_secure_secret_key_2026_huflit_cnpmnc';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, ACTIVE_SECRET);
}

module.exports = {
  JWT_SECRET: ACTIVE_SECRET,
  JWT_EXPIRES_IN,
  generateToken,
  verifyToken,
};
