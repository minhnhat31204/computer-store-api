const { verifyToken } = require('../services/jwtService');
const { User } = require('../models');

/**
 * Middleware bắt buộc phải có JWT hợp lệ trong header Authorization: Bearer <token>
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  // 1. Kiểm tra xác thực Basic Auth (Dành cho Swagger UI & Admin Database Console)
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, ...passwordParts] = credentials.split(':');
      const password = passwordParts.join(':');

      const adminUser = process.env.ADMIN_CONSOLE_USER || 'admin';
      const adminPass = process.env.ADMIN_CONSOLE_PASS || 'admin123450';

      if (username === adminUser && password === adminPass) {
        req.user = { userId: 0, role: 'Admin', fullName: 'Swagger Admin' };
        req.currentUser = { UserID: 0, Role: 'Admin', FullName: 'Swagger Admin' };
        return next();
      }
    } catch {
      // Bỏ qua lỗi giải mã Basic Auth
    }
  }

  // 2. Kiểm tra xác thực JWT Bearer Token (Header hoặc Query Param)
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7).trim()
    : (req.query?.token || req.query?.access_token || null);

  if (!token) {
    return res.status(401).json({ error: 'Không tìm thấy token xác thực. Vui lòng đăng nhập hoặc nhập token Bearer.' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;

    // Lấy thông tin user mới nhất từ CSDL
    const dbUser = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['PasswordHash'] },
    });

    if (!dbUser) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị khóa.' });
    }

    req.currentUser = dbUser;
    // Cập nhật role thực tế từ CSDL để phòng ngừa token cũ
    req.user.role = dbUser.Role;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', expired: true });
    }
    return res.status(403).json({ error: 'Mã xác thực (Token) không hợp lệ.' });
  }
}

/**
 * Middleware yêu cầu quyền Quản trị viên (Admin)
 */
function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Truy cập bị từ chối: Yêu cầu quyền Quản trị viên (Admin).' });
  }
  next();
}

/**
 * Middleware tùy chọn: nếu có token thì giải mã, không có thì vẫn cho qua
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.query?.token || null);

  if (!token) return next();

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
  } catch {
    // Không làm gì nếu token sai hoặc hết hạn ở chế độ tùy chọn
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth,
};
