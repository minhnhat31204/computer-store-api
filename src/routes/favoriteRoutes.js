const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');

// Láº¥y táº¥t cáº£ (phá»¥c vá»¥ Admin Panel /api/favorites)
router.get('/', favoriteController.getAllFavorites);

// Láº¥y theo UserID
router.get('/:userId', favoriteController.getFavorites);

// ThÃªm / Bá» yÃªu thÃ­ch
router.post('/toggle', favoriteController.toggleFavorite);

// XÃ³a báº£n ghi
router.delete('/:id', favoriteController.deleteFavorite);

module.exports = router;


