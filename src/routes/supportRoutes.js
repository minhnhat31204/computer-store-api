const express = require('express');
const controller = require('../controllers/supportController');
const router = express.Router();

router.post('/conversations/open', controller.openConversation);
router.get('/conversations', controller.listConversations);
router.get('/conversations/:id/messages', controller.getMessages);
router.post('/conversations/:id/messages', controller.sendMessage);
router.post('/conversations/:id/ai-reply', controller.aiReply);

module.exports = router;
