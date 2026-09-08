const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./src/models');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Import Toàn bộ Routes
app.use('/api/categories', require('./src/routes/categoryRoutes'));
app.use('/api/products', require('./src/routes/productRoutes'));
app.use('/api/product-variants', require('./src/routes/productVariantRoutes'));
app.use('/api/vouchers', require('./src/routes/voucherRoutes'));
app.use('/api/promotions', require('./src/routes/promotionRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/cart', require('./src/routes/cartRoutes'));
app.use('/api/orders', require('./src/routes/orderRoutes'));
app.use('/api/order-items', require('./src/routes/orderItemRoutes')); // Nơi hay bị thiếu
app.use('/api/reviews', require('./src/routes/reviewRoutes'));
app.use('/api/build-pc', require('./src/routes/buildPcRoutes'));

const PORT = process.env.PORT || 5000;

sequelize.sync().then(() => {
  console.log('Đã kết nối CSDL thành công.');
  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
    console.log(`Giao diện Admin: http://localhost:${PORT}/admin.html`);
  });
}).catch(err => {
  console.error('Lỗi kết nối CSDL:', err);
});