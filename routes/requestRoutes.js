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
    approvePitchClaim,
    rejectPitchClaim,
    updateRelationshipNote,
    getSentRequests,
    cancelRequest,
    getMyProjects,
    completeProject,
    updateProjectTitle
} = require('../controllers/requestController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, sendRequest);
router.get('/received', protect, getReceivedRequests);
router.get('/sent', protect, getSentRequests);
router.get('/my-projects', protect, getMyProjects);
router.get('/public', getPublicPitches); // Publicly viewable Hub
router.put('/relationship/end', protect, endRelationship);
router.put('/history/note', protect, updateRelationshipNote);
router.put('/:id/complete', protect, completeProject);
router.put('/:id/title', protect, updateProjectTitle);
router.put('/:id/claim', protect, claimPublicPitch);
router.put('/:id/approve-claim', protect, approvePitchClaim);
router.put('/:id/reject-claim', protect, rejectPitchClaim);
router.put('/:id/respond', protect, respondToRequest);
router.delete('/:id/read', protect, markAsRead);
router.delete('/:id', protect, cancelRequest);
router.get('/check/:userId', protect, checkConnection);

module.exports = router;
