const router = require('express').Router();
const c = require('../controllers/userController');
const userController = require('../controllers/userController');

router.get('/', c.getAll);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.delete);
router.post('/check-phone', userController.checkPhone);

module.exports = router;