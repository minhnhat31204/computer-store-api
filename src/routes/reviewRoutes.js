const router = require('express').Router();
const c = require('../controllers/reviewController');

router.get('/', c.getAll); // Thêm route này để sửa lỗi HTTP 404 trên Web Dashboard
router.get('/product/:productId', c.getByProduct);
router.get('/check-eligibility', c.checkEligibility);
router.post('/', c.create);
router.delete('/:id', c.delete);

module.exports = router;