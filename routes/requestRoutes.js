const express = require('express');
const router = express.Router();
const {
    sendRequest,
    getReceivedRequests,
    getPublicPitches,
    claimPublicPitch,
    respondToRequest,
    markAsRead,
    checkConnection,
    endRelationship,
    updateMentorshipNote,
    getSentRequests,
    cancelRequest
} = require('../controllers/requestController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, sendRequest);
router.get('/received', protect, getReceivedRequests);
router.get('/sent', protect, getSentRequests);
router.get('/public', getPublicPitches); // Publicly viewable Hub
router.put('/relationship/end', protect, endRelationship);
router.put('/history/note', protect, updateMentorshipNote);
router.put('/:id/claim', protect, claimPublicPitch);
router.put('/:id/respond', protect, respondToRequest);
router.delete('/:id/read', protect, markAsRead);
router.delete('/:id', protect, cancelRequest);
router.get('/check/:userId', protect, checkConnection);

module.exports = router;
