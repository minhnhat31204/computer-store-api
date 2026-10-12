const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');

router.get('/', productController.getAllProducts);
router.post('/', authenticateToken, requireAdmin, productController.createProduct);
router.put('/:id', authenticateToken, requireAdmin, productController.updateProduct);
router.delete('/:id', authenticateToken, requireAdmin, productController.deleteProduct);

module.exports = router;


