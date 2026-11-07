const router = require('express').Router();
const c = require('../controllers/cartController');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');

// Chỉ Admin mới được xem toàn bộ giỏ hàng của tất cả người dùng
router.get('/', authenticateToken, requireAdmin, c.getAll);

// Lấy giỏ hàng theo UserID
router.get('/:userId', c.getByUser);

// Thêm sản phẩm vào giỏ
router.post('/add', c.addToCart);

// Cập nhật số lượng
router.put('/update', c.update);
router.put('/:id', c.update);

// Xóa sản phẩm khỏi giỏ
router.delete('/:id', c.delete);

module.exports = router;
