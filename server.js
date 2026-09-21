const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./src/models');
require('dotenv').config();

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/categories', require('./src/routes/categoryRoutes'));
app.use('/api/products', require('./src/routes/productRoutes'));
app.use('/api/product-variants', require('./src/routes/productVariantRoutes'));
app.use('/api/vouchers', require('./src/routes/voucherRoutes'));
app.use('/api/promotions', require('./src/routes/promotionRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/cart', require('./src/routes/cartRoutes'));
app.use('/api/orders', require('./src/routes/orderRoutes'));
app.use('/api/order-items', require('./src/routes/orderItemRoutes'));
app.use('/api/reviews', require('./src/routes/reviewRoutes'));
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/favorites', require('./src/routes/favoriteRoutes'));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });

const PORT = Number(process.env.PORT || 5000);
sequelize.authenticate()
  .then(() => sequelize.sync())
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`API running on port ${PORT}`)))
  .catch(err => { console.error('Database startup error:', err); process.exitCode = 1; });
