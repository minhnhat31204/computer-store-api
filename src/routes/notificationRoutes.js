const router = require('express').Router();
const controller = require('../controllers/notificationController');

router.get('/user/:userId', controller.listForUser);
router.patch('/user/:userId/read-all', controller.markAllRead);
router.patch('/user/:userId/:notificationId/read', controller.setRead);

module.exports = router;
