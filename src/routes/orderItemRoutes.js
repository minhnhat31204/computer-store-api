const router = require('express').Router();
const c = require('../controllers/orderItemController');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');

router.get('/', authenticateToken, requireAdmin, c.getAll);
router.get('/order/:orderId', authenticateToken, c.getByOrder);
router.post('/', authenticateToken, requireAdmin, c.create);
router.put('/:id', authenticateToken, requireAdmin, c.update);
router.delete('/:id', authenticateToken, requireAdmin, c.delete);

module.exports = router;
