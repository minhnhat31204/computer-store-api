const router = require('express').Router();
const c = require('../controllers/categoryController');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');

router.get('/', c.getAll);
router.post('/', authenticateToken, requireAdmin, c.create);
router.delete('/:id', authenticateToken, requireAdmin, c.delete);
router.put('/:id', authenticateToken, requireAdmin, c.update);

module.exports = router;


