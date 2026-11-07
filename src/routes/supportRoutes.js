const express = require('express');
const controller = require('../controllers/supportController');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');
const { supportLimiter } = require('../middlewares/rateLimiter');

router.post('/conversations/open', controller.openConversation);
router.get('/conversations', authenticateToken, requireAdmin, controller.listConversations);
router.get('/conversations/:id/messages', controller.getMessages);
router.post('/conversations/:id/messages', supportLimiter, controller.sendMessage);
router.post('/conversations/:id/ai-reply', supportLimiter, controller.aiReply);

module.exports = router;
