const router = require('express').Router();
const c = require('../controllers/orderItemController');

router.get('/', c.getAll);
router.get('/order/:orderId', c.getByOrder);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.delete);

module.exports = router;