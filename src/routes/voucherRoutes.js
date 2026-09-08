const router = require('express').Router();
const voucherController = require('../controllers/voucherController');

router.get('/', voucherController.getAllVouchers);
router.post('/', voucherController.createVoucher);
router.put('/:id', voucherController.updateVoucher);
router.delete('/:id', voucherController.deleteVoucher);

module.exports = router;