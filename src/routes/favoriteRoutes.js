const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');

// Chỉ Admin mới được xem toàn bộ danh sách yêu thích
router.get('/', authenticateToken, requireAdmin, favoriteController.getAllFavorites);

// Lấy theo UserID
router.get('/:userId', favoriteController.getFavorites);

// Thêm / Bỏ yêu thích
router.post('/toggle', favoriteController.toggleFavorite);

// Xóa bản ghi
router.delete('/:id', favoriteController.deleteFavorite);

module.exports = router;
