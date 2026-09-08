const router = require('express').Router();
const c = require('../controllers/cartController');

router.get('/', c.getAll);
router.get('/user/:userId', c.getByUser);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.delete);

module.exports = router;