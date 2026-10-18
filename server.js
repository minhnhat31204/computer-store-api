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

// Giới hạn riêng cho API xác thực/đăng nhập: tối đa 30 lần trong 1 phút
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Thao tác quá nhanh. Vui lòng thử lại sau 1 phút.' },
});
app.use('/api/auth', authLimiter);

const allowedOrigins = (process.env.FRONTEND_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, credentials: true }));
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
const upload = multer({ storage: storage });

app.post('/api/products/upload', upload.single('image'), (req, res) => {
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

const basicAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="DEVORA Admin Console & Swagger Docs"');
    return res.status(401).send('Authentication required: Vui lòng đăng nhập để truy cập Admin Console và Swagger API.');
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, ...passwordParts] = credentials.split(':');
    const password = passwordParts.join(':');

    const adminUser = process.env.ADMIN_CONSOLE_USER || 'admin';
    const adminPass = process.env.ADMIN_CONSOLE_PASS || 'admin123450';

    if (username === adminUser && password === adminPass) {
      return next();
    }
  } catch (e) {
    // Ignore error
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="DEVORA Admin Console & Swagger Docs"');
  return res.status(401).send('Tài khoản hoặc mật khẩu không chính xác.');
};

const handleApiRoot = (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } else {
    res.json(apiOverview);
  }
};

// Protected routes (Admin Database Console & Swagger Docs)
app.get(['/', '/api', '/api/', '/admin.html'], basicAuth, handleApiRoot);
app.get(['/api/docs', '/api/swagger', '/docs', '/swagger', '/swagger.html', '/api/swagger.html'], basicAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'swagger.html'));
});
app.get(['/api/swagger.json', '/swagger.json'], basicAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'swagger.json'));
});
app.get(['/api/logout', '/logout'], (_req, res) => {
  res.setHeader('WWW-Authenticate', 'Basic realm="DEVORA Admin Console & Swagger Docs"');
  res.status(401).send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>Đã Đăng Xuất - DEVORA</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 36px 32px; max-width: 440px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
        .icon { font-size: 48px; margin-bottom: 16px; }
        h2 { margin: 0 0 10px; font-size: 22px; color: #fff; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px; }
        .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 12px; font-size: 14px; transition: 0.2s; }
        .btn:hover { background: #1d4ed8; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">🔒</div>
        <h2>Đã Đăng Xuất Thành Công</h2>
        <p>Phiên bảo mật đã được xóa khỏi trình duyệt. Bất kỳ ai truy cập lại trang Swagger hay Console đều phải nhập chính xác tài khoản và mật khẩu quản trị viên.</p>
        <a href="/api/swagger" class="btn">Đăng Nhập Lại Vào Swagger</a>
      </div>
    </body>
    </html>
  `);
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
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

sequelize.authenticate()
  .then(() => sequelize.sync())
  .then(ensurePhoneOnlyEmailSchema)
  .then(ensureOrderInventoryColumn)
  .then(ensureReviewReplyColumns)
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`API running on port ${PORT}`)))
  .catch(err => { console.error('Database startup error:', err); });
