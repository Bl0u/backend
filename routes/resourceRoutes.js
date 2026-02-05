const express = require('express');
const router = express.Router();
const {
    createThread,
    getThreads,
    getThreadDetail,
    updateThread,
    deleteThread,
    addModerator,
    removeModerator,
    toggleGuideVote,
    addPost,
    deletePost,
    toggleUpvote,
    requestReview,
    acknowledgeInstructions,
    updateInstructions
} = require('../controllers/resourceController');
const { protect } = require('../middleware/authMiddleware');
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
router.post('/thread', protect, upload.single('file'), createThread);
router.get('/thread/:id', getThreadDetail);
router.put('/thread/:id', protect, updateThread);
router.delete('/thread/:id', protect, deleteThread);
router.post('/thread/:id/moderator', protect, addModerator);
router.put('/thread/:id/guide', protect, toggleGuideVote);
router.post('/thread/:id/post', protect, upload.single('file'), addPost);
router.delete('/post/:id', protect, deletePost);
router.put('/post/:id/upvote', protect, toggleUpvote);
router.post('/post/:id/review', protect, requestReview);

router.post('/thread/:id/acknowledge', protect, acknowledgeInstructions);
router.delete('/thread/:id/moderator/:userId', protect, removeModerator);
router.put('/thread/:id/instructions', protect, updateInstructions);

module.exports = router;
