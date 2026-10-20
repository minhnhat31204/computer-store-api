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

const getCookie = (req, name) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
};

const renderConsoleLoginHtml = (redirectUrl = '/api/swagger', errorMsg = '', infoMsg = '') => {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đăng nhập Quản trị & Swagger - DEVORA</title>
  <link rel="icon" type="image/png" href="/devora-icon.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { background-color: #020617; }
  </style>
</head>
<body class="min-h-screen text-slate-100 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white font-sans">
  <div class="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-blue-950/40 backdrop-blur-xl">
    <div class="text-center mb-7">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-blue-400/30 mb-3 shadow-lg shadow-blue-600/30">
        <i class="fa-solid fa-shield-halved text-white text-2xl"></i>
      </div>
      <h1 class="text-xl font-black text-white tracking-tight">DEVORA System Console</h1>
      <p class="text-xs text-slate-400 mt-1">Vui lòng tự nhập tài khoản quản trị để truy cập hệ thống</p>
    </div>

    ${errorMsg ? `
    <div class="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold flex items-center gap-2.5">
      <i class="fa-solid fa-circle-exclamation text-base shrink-0"></i>
      <span>${errorMsg}</span>
    </div>` : ''}

    ${infoMsg ? `
    <div class="mb-5 p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-xs font-semibold flex items-center gap-2.5">
      <i class="fa-solid fa-circle-info text-base shrink-0"></i>
      <span>${infoMsg}</span>
    </div>` : ''}

    <form method="POST" action="/api/console-login" autocomplete="off" class="space-y-4">
      <input type="hidden" name="redirect" value="${redirectUrl}">
      
      <div>
        <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Tên tài khoản</label>
        <div class="relative">
          <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 text-sm">
            <i class="fa-solid fa-user"></i>
          </span>
          <input 
            type="text" 
            name="console_user" 
            required 
            autocomplete="off" 
            placeholder="Nhập tên đăng nhập quản trị"
            value=""
            class="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none transition"
          />
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Mật khẩu</label>
        <div class="relative">
          <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 text-sm">
            <i class="fa-solid fa-lock"></i>
          </span>
          <input 
            type="password" 
            name="console_pass" 
            required 
            autocomplete="new-password" 
            placeholder="Nhập mật khẩu"
            value=""
            class="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none transition"
          />
        </div>
      </div>

      <button 
        type="submit" 
        class="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/25 transition active:scale-[0.98] cursor-pointer"
      >
        Đăng nhập vào Hệ thống
      </button>
    </form>

    <div class="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-medium">
      <a href="https://devora.id.vn" class="hover:text-blue-400 transition inline-flex items-center gap-1.5">
        <i class="fa-solid fa-arrow-left"></i> Trang chủ Shop
      </a>
      <span class="text-slate-600">DEVORA v2.5</span>
    </div>
  </div>
</body>
</html>`;
};

const consoleAuth = (req, res, next) => {
  const adminUser = process.env.ADMIN_CONSOLE_USER || 'admin';
  const adminPass = process.env.ADMIN_CONSOLE_PASS || 'admin123450';

  // 1. Support Basic Auth header (curl / automated scripts)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, ...passwordParts] = credentials.split(':');
      const password = passwordParts.join(':');
      if (username === adminUser && password === adminPass) {
        return next();
      }
    } catch (e) {}
  }

  // 2. Support JWT session cookie
  const token = getCookie(req, 'devora_console_session');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.role === 'admin_console') {
        return next();
      }
    } catch (e) {}
  }

  // 3. Not authenticated
  if (req.path.endsWith('.json') || (!req.accepts('html') && req.accepts('json'))) {
    return res.status(401).json({ error: 'Authentication required: Vui lòng đăng nhập để truy cập tài nguyên.' });
  }

  // Render Web Login Form directly with blank inputs (never triggers browser native pop-up!)
  const redirectUrl = req.originalUrl || req.url || '/api/swagger';
  return res.status(200).send(renderConsoleLoginHtml(redirectUrl));
};

const handleApiRoot = (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } else {
    res.json(apiOverview);
  }
};

app.post('/api/console-login', (req, res) => {
  const adminUser = process.env.ADMIN_CONSOLE_USER || 'admin';
  const adminPass = process.env.ADMIN_CONSOLE_PASS || 'admin123450';
  const redirectUrl = req.body.redirect || '/api/swagger';

  const user = (req.body.console_user || req.body.username || '').trim();
  const pass = req.body.console_pass || req.body.password || '';

  if (user === adminUser && pass === adminPass) {
    const token = jwt.sign({ role: 'admin_console' }, JWT_SECRET, { expiresIn: '8h' });
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `devora_console_session=${token}; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}`);
    return res.redirect(redirectUrl);
  }

  return res.status(401).send(renderConsoleLoginHtml(redirectUrl, 'Tên đăng nhập hoặc mật khẩu không chính xác.'));
});

app.get(['/api/logout', '/logout'], (req, res) => {
  res.setHeader('Set-Cookie', 'devora_console_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
  return res.status(200).send(renderConsoleLoginHtml('/api/swagger', '', 'Bạn đã đăng xuất khỏi phiên làm việc thành công.'));
});

// Protected routes (Admin Database Console & Swagger Docs)
app.get(['/', '/api', '/api/', '/admin.html', '/api/admin.html', '/api/admin'], consoleAuth, handleApiRoot);
app.get(['/api/docs', '/api/swagger', '/docs', '/swagger', '/swagger.html', '/api/swagger.html'], consoleAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'swagger.html'));
});
app.get(['/api/swagger.json', '/swagger.json'], consoleAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'swagger.json'));
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
