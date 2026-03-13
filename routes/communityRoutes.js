const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const GroupChat = require('../models/GroupChat');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get all communities
// @route   GET /api/communities
// @access  Public (or Protected if preferred)
router.get('/', async (req, res) => {
    try {
        const communities = await Community.find({}).populate('creator', 'name username');
        res.json(communities);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Get a community and its circles
// @route   GET /api/communities/:id
// @access  Public (Private circles will be filtered or access-checked)
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

module.exports = router;
