const router = require('express').Router();
const c = require('../controllers/reviewController');

router.get('/', c.getAll);
router.get('/check-order', c.checkOrderReview);
router.post('/order', c.createOrderReview);
router.get('/product/:productId', c.getByProduct);
router.get('/check-eligibility', c.checkEligibility);
router.post('/', c.create);
router.delete('/:id', c.delete);

module.exports = router;


