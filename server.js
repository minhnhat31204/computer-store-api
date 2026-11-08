const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { DataTypes } = require('sequelize');
const { sequelize } = require('./src/models');
const Order = require('./src/models/Order');
const Review = require('./src/models/Review');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./src/services/jwtService');
const { authenticateToken, requireAdmin } = require('./src/middlewares/authMiddleware');
const { uploadLimiter } = require('./src/middlewares/rateLimiter');
require('dotenv').config();

const app = express();

// Trust reverse proxy (Nginx on VPS)
app.set('trust proxy', 1);

// Chống DDOS / Flood request: tối đa 600 requests trong 1 phút cho mỗi IP
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Hệ thống phát hiện quá nhiều yêu cầu từ bạn. Vui lòng thử lại sau 1 phút.' },
});
app.use(generalLimiter);

// Bổ sung Security Headers chống XSS, Clickjacking, MIME Sniffing
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// Giới hạn riêng cho API xác thực/đăng nhập: tối đa 30 lần trong 1 phút
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Thao tác quá nhanh. Vui lòng thử lại sau 1 phút.' },
});
app.use('/api/auth', authLimiter);

const defaultAllowedOrigins = [
  'https://devora.id.vn',
  'https://www.devora.id.vn',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
const envOrigins = (process.env.FRONTEND_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
const allowedOrigins = envOrigins.length ? envOrigins : defaultAllowedOrigins;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('Chặn bởi chính sách bảo mật CORS (Origin không được phép).'));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s/g, '_'));
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return cb(new Error('Chỉ chấp nhận file ảnh JPG, PNG, WEBP hoặc GIF.'));
    }
    cb(null, true);
  }
});

app.post('/api/products/upload', authenticateToken, requireAdmin, uploadLimiter, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không tìm thấy file' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

const apiOverview = {
  name: "DEVORA Computer Store API",
  status: "online",
  version: "1.0.0",
  timestamp: new Date().toISOString(),
  database: "SQL Server (Connected)",
  endpoints: [
    { method: "GET", path: "/api/products", description: "Danh sách sản phẩm & bộ lọc" },
    { method: "GET", path: "/api/categories", description: "Danh mục hàng hóa" },
    { method: "GET", path: "/api/promotions", description: "Banner quảng cáo & khuyến mãi" },
    { method: "GET", path: "/api/vouchers", description: "Danh sách mã giảm giá" },
    { method: "GET", path: "/api/orders", description: "Quản lý đơn hàng" },
    { method: "POST", path: "/api/auth/login", description: "API Đăng nhập" },
    { method: "POST", path: "/api/auth/register", description: "API Đăng ký tài khoản" },
    { method: "GET", path: "/api/health", description: "Kiểm tra máy chủ (Health Check)" },
  ]
};

const handleApiRoot = (_req, res) => {
  res.json({
    name: 'DEVORA API Service',
    status: 'online',
    timestamp: new Date().toISOString()
  });
};

app.get(['/', '/api', '/api/'], handleApiRoot);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use('/api/uploads', express.static(uploadDir));
const routes = [
  ['/api/categories', './src/routes/categoryRoutes'],
  ['/api/products', './src/routes/productRoutes'],
  ['/api/product-variants', './src/routes/productVariantRoutes'],
  ['/api/vouchers', './src/routes/voucherRoutes'],
  ['/api/promotions', './src/routes/promotionRoutes'],
  ['/api/users', './src/routes/userRoutes'],
  ['/api/cart', './src/routes/cartRoutes'],
  ['/api/orders', './src/routes/orderRoutes'],
  ['/api/notifications', './src/routes/notificationRoutes'],
  ['/api/order-items', './src/routes/orderItemRoutes'],
  ['/api/reviews', './src/routes/reviewRoutes'],
  ['/api/auth', './src/routes/authRoutes'],
  ['/api/favorites', './src/routes/favoriteRoutes'],
  ['/api/addresses', './src/routes/addressRoutes'],
  ['/api/support', './src/routes/supportRoutes'],
  ['/api/upload', './src/routes/uploadRoutes'],
];

routes.forEach(([pathUrl, routePath]) => {
  try {
    app.use(pathUrl, require(routePath));
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.requireStack && err.requireStack[0] === __filename) {
      console.warn(`[Route Warning] File ${routePath} not found, skipped.`);
    } else {
      console.error(`[Route Error] ${routePath}:`, err.message);
    }
  }
});

app.use((err, _req, res, _next) => { 
  console.error(err); 
  res.status(500).json({ error: 'Internal server error' }); 
});

const PORT = Number(process.env.PORT || 5000);
async function ensureOrderInventoryColumn() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tableName = Order.getTableName();
    const columns = await queryInterface.describeTable(tableName);
    if (!columns.InventoryReserved) {
      await queryInterface.addColumn(tableName, 'InventoryReserved', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    for (const [name, definition] of Object.entries({
      CarrierName: { type: DataTypes.STRING(100), allowNull: true },
      TrackingNumber: { type: DataTypes.STRING(150), allowNull: true },
      EstimatedDelivery: { type: DataTypes.DATEONLY, allowNull: true },
      RefundRequestAt: { type: DataTypes.DATE, allowNull: true },
      RefundBankName: { type: DataTypes.STRING(100), allowNull: true },
      RefundBankAccount: { type: DataTypes.STRING(100), allowNull: true },
      RefundBankHolder: { type: DataTypes.STRING(150), allowNull: true },
      RefundPhone: { type: DataTypes.STRING(50), allowNull: true },
      RefundReason: { type: DataTypes.TEXT, allowNull: true },
      RefundStatus: { type: DataTypes.STRING(50), allowNull: true },
      RefundApprovedAt: { type: DataTypes.DATE, allowNull: true },
    })) {
      if (!columns[name]) await queryInterface.addColumn(tableName, name, definition);
    }

    const { Promotion } = require('./src/models');
    const promoTable = Promotion.getTableName();
    const promoCols = await queryInterface.describeTable(promoTable);
    for (const [name, definition] of Object.entries({
      LinkUrl: { type: DataTypes.STRING, allowNull: true },
      DiscountPercent: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      ProductIDs: { type: DataTypes.TEXT, allowNull: true },
      IsActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      StartDate: { type: DataTypes.DATEONLY, allowNull: true },
      EndDate: { type: DataTypes.DATEONLY, allowNull: true },
    })) {
      if (!promoCols[name]) await queryInterface.addColumn(promoTable, name, definition);
    }
  } catch (err) {
    console.warn('ensureOrderInventoryColumn warning:', err.message);
  }
}

async function ensurePhoneOnlyEmailSchema() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', '20260929-phone-only-users.sql');
    if (!fs.existsSync(migrationPath)) return;
    const batches = fs.readFileSync(migrationPath, 'utf8')
      .split(/^\s*GO\s*$/gim)
      .map(batch => batch.trim())
      .filter(Boolean);
    for (const batch of batches) await sequelize.query(batch);
    // Tự động đồng bộ Email = RecoveryEmail nếu Email còn trống hoặc là email tạm
    try {
      await sequelize.query(`
        UPDATE [dbo].[Users]
        SET [Email] = [RecoveryEmail]
        WHERE ([Email] IS NULL OR [Email] LIKE N'%@phone.%')
          AND [RecoveryEmail] IS NOT NULL
          AND [RecoveryEmailVerified] = 1;
      `);
    } catch (_) {}
  } catch (err) {
    console.warn('ensurePhoneOnlyEmailSchema warning:', err.message);
  }
}

async function ensureReviewReplyColumns() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tableName = Review.getTableName();
    const columns = await queryInterface.describeTable(tableName);
    for (const [name, definition] of Object.entries({
      AdminReply: { type: DataTypes.TEXT, allowNull: true },
      AdminReplyAt: { type: DataTypes.DATE, allowNull: true },
      AdminReplyUserID: { type: DataTypes.INTEGER, allowNull: true },
    })) {
      if (!columns[name]) await queryInterface.addColumn(tableName, name, definition);
    }
  } catch (err) {
    console.warn('ensureReviewReplyColumns warning:', err.message);
  }
}


async function ensureVouchersStatus() {
  try {
    const { Voucher } = require('./src/models');
    if (!Voucher) return;

    // 1 voucher hết hạn sử dụng không áp dụng được (TEST)
    await Voucher.update(
      { ExpiryDate: '2024-10-30 23:59:59', IsActive: true },
      { where: { Code: 'TEST' } }
    );

    // Các voucher còn hạn sử dụng và áp dụng được bình thường (SALE20, SUMMER2026)
    await Voucher.update(
      { ExpiryDate: '2026-12-31 23:59:59', IsActive: true },
      { where: { Code: ['SALE20', 'SUMMER2026'] } }
    );
  } catch (err) {
    console.warn('ensureVouchersStatus warning:', err.message);
  }
}

sequelize.authenticate()
  .then(() => sequelize.sync())
  .then(ensurePhoneOnlyEmailSchema)
  .then(ensureOrderInventoryColumn)
  .then(ensureReviewReplyColumns)
  .then(ensureVouchersStatus)
  .then(() => app.listen(PORT, '127.0.0.1', () => console.log(`API running on port ${PORT}`)))
  .catch(err => { console.error('Database startup error:', err); });
