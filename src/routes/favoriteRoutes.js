const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');

// Lấy tất cả (phục vụ Admin Panel /api/favorites)
router.get('/', favoriteController.getAllFavorites);

// Lấy theo UserID
router.get('/:userId', favoriteController.getFavorites);

// Thêm / Bỏ yêu thích
router.post('/toggle', favoriteController.toggleFavorite);

// Xóa bản ghi
router.delete('/:id', favoriteController.deleteFavorite);

module.exports = router;