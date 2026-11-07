const router = require('express').Router();
const controller = require('../controllers/addressController');
const { authenticateToken } = require('../middlewares/authMiddleware');

function verifyAddressOwnership(req, res, next) {
  const targetUserId = Number(req.params.userId);
  const requesterRole = String(req.user?.role || '').toLowerCase();
  const requesterId = Number(req.user?.userId || req.user?.UserID || 0);
  if (requesterRole !== 'admin' && requesterId !== targetUserId) {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập sổ địa chỉ của người dùng khác.' });
  }
  next();
}

router.use(authenticateToken);

router.get('/user/:userId', verifyAddressOwnership, controller.list);
router.post('/user/:userId/import', verifyAddressOwnership, controller.importLegacy);
router.post('/user/:userId', verifyAddressOwnership, controller.create);
router.put('/user/:userId/:addressId/default', verifyAddressOwnership, controller.setDefault);
router.put('/user/:userId/:addressId', verifyAddressOwnership, controller.update);
router.delete('/user/:userId/:addressId', verifyAddressOwnership, controller.remove);

module.exports = router;
