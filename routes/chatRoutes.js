const express = require('express');
const router = express.Router();
const {
    getRecentChats,
    getMessages,
    sendMessage,
    getUnreadCount
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.get('/recent', protect, getRecentChats);
router.get('/unread', protect, getUnreadCount);
router.post('/', protect, sendMessage);
router.get('/:targetUserId', protect, getMessages);

module.exports = router;
