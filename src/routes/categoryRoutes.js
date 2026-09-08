const router = require('express').Router();
const c = require('../controllers/categoryController');

router.get('/', c.getAll);
router.post('/', c.create);
router.delete('/:id', c.delete);
router.put('/:id', c.update);

module.exports = router;