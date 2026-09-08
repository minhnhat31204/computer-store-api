const router = require('express').Router();
const c = require('../controllers/reviewController');

router.get('/', c.getAll);
router.get('/product/:productId', c.getByProduct);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.delete);

module.exports = router;