const router = require('express').Router();
const c = require('../controllers/orderController');

router.post('/payos/webhook', c.handlePayOSWebhook);
router.post('/:id/payos-payment', c.createPayOSPayment);
router.get('/:id/payment-status', c.getPaymentStatus);
router.get('/', c.getAll);
router.get('/user/:userId', c.getByUserId); // ThÃªm route nÃ y náº¿u App Flutter láº¥y theo UserID
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.delete);

module.exports = router;

