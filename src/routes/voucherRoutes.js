const router = require('express').Router();
const voucherController = require('../controllers/voucherController');

router.get('/', voucherController.getAllVouchers);
router.post('/validate', voucherController.validateVoucher);
router.get('/code/:code', voucherController.getVoucherByCode);
router.get('/:id', voucherController.getVoucherById);
router.post('/', voucherController.createVoucher);
router.put('/:id', voucherController.updateVoucher);
router.delete('/:id', voucherController.deleteVoucher);

module.exports = router;
