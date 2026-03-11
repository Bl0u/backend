const express = require('express');
const router = express.Router();
const {
    getRecentChats,
    getMessages,
    sendMessage,
    getUnreadCount,
    createGroupChat,
    addMemberToGroup
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.get('/recent', protect, getRecentChats);
router.get('/unread', protect, getUnreadCount);
router.post('/', protect, sendMessage);
router.post('/groups', protect, createGroupChat);
router.post('/groups/:id/members', protect, addMemberToGroup);
router.get('/:targetId', protect, getMessages);

module.exports = router;
