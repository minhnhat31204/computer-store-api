const router = require('express').Router();
const c = require('../controllers/buildPcController');

router.get('/', c.getAll);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.delete);

module.exports = router;