const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const GroupChat = require('../models/GroupChat');
const { protect } = require('../middleware/authMiddleware');

const {
    getModeratedContent,
    getJoinedContent,
    getMembers,
    toggleBan,
    createCircle,
    deleteCircle,
    leaveGroup
} = require('../controllers/communityController');

// @desc    Get all communities
// @route   GET /api/communities
// @access  Public
router.get('/', async (req, res) => {
    try {
        const communities = await Community.find({}).populate('creator', 'name username');
        res.json(communities);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Get moderated communities/groups
router.get('/moderated', protect, getModeratedContent);

// @desc    Get joined communities/groups
router.get('/joined', protect, getJoinedContent);

// @desc    Get a community and its circles
// @route   GET /api/communities/:id
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ message: 'Community not found' });

        const circles = await GroupChat.find({ communityId: community._id });
        
        res.json({
            community,
            circles
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Management Routes
router.get('/:id/members', protect, getMembers);
router.put('/:id/ban', protect, toggleBan);
router.post('/:id/groups', protect, createCircle);
router.delete('/groups/:groupId', protect, deleteCircle);
router.delete('/groups/:groupId/leave', protect, leaveGroup);
router.get('/groups/:id/members', protect, getMembers);

module.exports = router;
