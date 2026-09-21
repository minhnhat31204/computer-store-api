const router = require('express').Router();
const c = require('../controllers/orderController');

router.get('/', c.getAll);
router.get('/user/:userId', c.getByUserId); // ThÃªm route nÃ y náº¿u App Flutter láº¥y theo UserID
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.delete);

module.exports = router;


