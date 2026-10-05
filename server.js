const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { DataTypes } = require('sequelize');
const { sequelize } = require('./src/models');
const Order = require('./src/models/Order');
require('dotenv').config();

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

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
  name: "MANB Computer Store API",
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

const handleApiRoot = (req, res) => {
  if (req.accepts('html')) {
    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MANB API - Backend Overview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-slate-950 text-slate-100 font-sans min-h-screen flex flex-col justify-center p-4 md:p-8">
  <div class="max-w-4xl mx-auto w-full">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-blue-500/30">M</div>
          <h1 class="text-2xl font-bold tracking-tight text-white">MANB Store Backend API</h1>
        </div>
        <p class="text-slate-400 text-sm mt-1.5">Máy chủ dịch vụ API & Cơ sở dữ liệu Microsoft SQL Server</p>
      </div>
      <div class="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl text-sm font-semibold">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        Hệ thống Online 24/7
      </div>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <i class="fa-solid fa-network-wired text-blue-400"></i> Danh sách REST API Endpoints
      </h2>
      <div class="space-y-3">
        ${apiOverview.endpoints.map(ep => `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition gap-2">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 rounded-md text-xs font-mono font-bold ${ep.method === 'GET' ? 'bg-blue-900/60 text-blue-300 border border-blue-500/30' : 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/30'}">${ep.method}</span>
              <a href="${ep.path}" target="_blank" class="font-mono text-sm text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5">
                ${ep.path} <i class="fa-solid fa-arrow-up-right-from-square text-xs opacity-60"></i>
              </a>
            </div>
            <span class="text-slate-400 text-xs sm:text-sm">${ep.description}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <footer class="text-center text-slate-500 text-xs mt-8">
      MANB Store Backend System • Microsoft SQL Server 2022 • Express.js
    </footer>
  </div>
</body>
</html>`);
  } else {
    res.json(apiOverview);
  }
};

app.get(['/', '/api', '/api/'], handleApiRoot);
app.get('/api/health', (_req, res) => res.json({ ok: true }));
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
    })) {
      if (!columns[name]) await queryInterface.addColumn(tableName, name, definition);
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

sequelize.authenticate()
  .then(() => sequelize.sync())
  .then(ensurePhoneOnlyEmailSchema)
  .then(ensureOrderInventoryColumn)
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`API running on port ${PORT}`)))
  .catch(err => { console.error('Database startup error:', err); });
