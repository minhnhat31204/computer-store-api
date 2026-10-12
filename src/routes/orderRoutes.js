const router = require('express').Router();
const c = require('../controllers/orderController');

const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');

router.get('/payos/webhook', (req, res) => res.status(200).json({ success: true, message: 'PayOS webhook endpoint is active' }));
router.post('/payos/webhook', c.handlePayOSWebhook);
router.post('/:id/payos-payment', authenticateToken, c.createPayOSPayment);
router.get('/:id/payment-status', authenticateToken, c.getPaymentStatus);
router.get('/', authenticateToken, requireAdmin, c.getAll);
router.get('/:id/history', authenticateToken, c.getStatusHistory);
router.get('/user/:userId', authenticateToken, c.getByUserId);
router.post('/', authenticateToken, c.create);
router.post('/:id/cancel', authenticateToken, c.cancelByUser);
router.patch('/:id/status', authenticateToken, requireAdmin, c.updateStatus);
router.put('/:id', authenticateToken, requireAdmin, c.update);
router.delete('/:id', authenticateToken, requireAdmin, c.delete);

module.exports = router;

