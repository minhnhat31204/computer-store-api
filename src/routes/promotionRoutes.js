const router = require('express').Router();
const c = require('../controllers/promotionController');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');

router.get('/', c.getAll);
router.get('/:id', c.getById);
router.post('/', authenticateToken, requireAdmin, c.create);
router.put('/:id', authenticateToken, requireAdmin, c.update);
router.delete('/:id', authenticateToken, requireAdmin, c.delete);

module.exports = router;
