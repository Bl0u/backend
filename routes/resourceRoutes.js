const express = require('express');
const router = express.Router();
const {
    createThread,
    getThreads,
    getUniqueTags,
    getThreadDetail,
    updateThread,
    updateThreadPrice, // V2.0
    deleteThread,
    addModerator,
    removeModerator,
    toggleGuideVote,
    addPost,
    deletePost,
    toggleUpvote,
    requestReview,
    acknowledgeInstructions,
    updateInstructions,
    purchaseThread,
    togglePinThread,
    getUserActivity,
    getResourceMetadata,
    updateEarningsConfig, // V2.2
    getMyEarnings         // V2.2
} = require('../controllers/resourceController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Multer storage config
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename(req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({ storage });

router.get('/', getThreads);
router.get('/tags', getUniqueTags);
router.get('/metadata', getResourceMetadata);
router.post('/thread', protect, upload.single('file'), createThread);
router.get('/thread/:id', optionalAuth, getThreadDetail);
router.put('/thread/:id', protect, updateThread);
router.put('/thread/:id/price', protect, updateThreadPrice); // V2.0: Update thread price
router.delete('/thread/:id', protect, deleteThread);
router.post('/thread/:id/moderator', protect, addModerator);
router.put('/thread/:id/guide', protect, toggleGuideVote);
router.post('/thread/:id/post', protect, upload.single('file'), addPost);
router.post('/thread/:id/purchase', protect, purchaseThread); // V2.0: Purchase thread
router.put('/thread/:id/pin', protect, togglePinThread); // Pin thread
router.get('/activity', protect, getUserActivity); // Get user activity
router.delete('/post/:id', protect, deletePost);
router.put('/post/:id/upvote', protect, toggleUpvote);
router.post('/post/:id/review', protect, requestReview);

router.post('/thread/:id/acknowledge', protect, acknowledgeInstructions);
router.delete('/thread/:id/moderator/:userId', protect, removeModerator);
router.put('/thread/:id/instructions', protect, updateInstructions);
router.put('/thread/:id/earnings-config', protect, updateEarningsConfig); // V2.2: Revenue sharing config
router.get('/earnings/mine', protect, getMyEarnings); // V2.2: Personal earnings history

module.exports = router;
