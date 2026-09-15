const router = require('express').Router();
const c = require('../controllers/cartController');

// Lấy toàn bộ danh sách giỏ hàng
router.get('/', c.getAll);

// Lấy giỏ hàng theo UserID (Gọi từ Flutter: GET /api/cart/1)
router.get('/:userId', c.getByUser);

// Thêm sản phẩm vào giỏ (Gọi từ Flutter: POST /api/cart/add)
router.post('/add', c.addToCart);

// Cập nhật số lượng (Gọi từ Flutter: PUT /api/cart/update)
router.put('/update', c.update);
router.put('/:id', c.update);

// Xóa sản phẩm khỏi giỏ (DELETE /api/cart/:id)
router.delete('/:id', c.delete);

module.exports = router;