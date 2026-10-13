const router = require('express').Router();
const voucherController = require('../controllers/voucherController');

const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');

router.get('/', voucherController.getAllVouchers);
router.post('/validate', voucherController.validateVoucher);
router.get('/code/:code', voucherController.getVoucherByCode);
router.get('/:id', voucherController.getVoucherById);
router.post('/', authenticateToken, requireAdmin, voucherController.createVoucher);
router.put('/:id', authenticateToken, requireAdmin, voucherController.updateVoucher);
router.delete('/:id', authenticateToken, requireAdmin, voucherController.deleteVoucher);

module.exports = router;
