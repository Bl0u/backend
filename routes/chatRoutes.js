const express = require('express');
const router = express.Router();
const {
    getRecentChats,
    getMessages,
    sendMessage,
    createGroupChat,
    addMemberToGroup,
    getUnreadCount,
    requestJoinGroup,
    handleJoinRequest,
    getOrCreateProjectChat,
    syncRoleGroups
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/recent', getRecentChats);
router.get('/unread', getUnreadCount);
router.post('/groups', createGroupChat);
router.post('/groups/:id/members', addMemberToGroup);
router.post('/groups/:id/join', requestJoinGroup);
router.put('/requests/:id', handleJoinRequest);
router.post('/project-chat', getOrCreateProjectChat);
router.post('/groups/sync-roles', syncRoleGroups); // V2.2: Auto-join groups by role
router.get('/:targetId', getMessages);
router.post('/', sendMessage);

module.exports = router;
