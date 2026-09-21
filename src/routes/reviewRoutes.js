const router = require('express').Router();
const c = require('../controllers/reviewController');

router.get('/', c.getAll); // ThÃªm route nÃ y Ä‘á»ƒ sá»­a lá»—i HTTP 404 trÃªn Web Dashboard
router.get('/product/:productId', c.getByProduct);
router.get('/check-eligibility', c.checkEligibility);
router.post('/', c.create);
router.delete('/:id', c.delete);

module.exports = router;


