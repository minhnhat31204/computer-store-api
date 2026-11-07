const router = require('express').Router();
const controller = require('../controllers/notificationController');
const { authenticateToken } = require('../middlewares/authMiddleware');

function verifyNotificationOwnership(req, res, next) {
  const targetUserId = Number(req.params.userId);
  const requesterRole = String(req.user?.role || '').toLowerCase();
  const requesterId = Number(req.user?.userId || req.user?.UserID || 0);
  if (requesterRole !== 'admin' && requesterId !== targetUserId) {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập thông báo của người dùng khác.' });
  }
  next();
}

router.use(authenticateToken);

router.get('/user/:userId', verifyNotificationOwnership, controller.listForUser);
router.patch('/user/:userId/read-all', verifyNotificationOwnership, controller.markAllRead);
router.patch('/user/:userId/:notificationId/read', verifyNotificationOwnership, controller.setRead);

module.exports = router;
