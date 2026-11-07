const router = require('express').Router();
const c = require('../controllers/reviewController');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');

router.get('/admin', authenticateToken, requireAdmin, c.getAllAdmin);
router.patch('/:id/reply', authenticateToken, requireAdmin, c.replyToReview);
router.get('/', c.getAll);
router.get('/check-order', c.checkOrderReview);
router.post('/order', authenticateToken, c.createOrderReview);
router.get('/product/:productId', c.getByProduct);
router.get('/check-eligibility', c.checkEligibility);
router.post('/', authenticateToken, c.create);
router.delete('/:id', authenticateToken, c.delete);

module.exports = router;
