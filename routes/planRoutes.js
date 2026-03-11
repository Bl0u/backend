const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    createPlan,
    addVersion,
    editVersion,
    deleteVersion,
    getPlan,
    getPlanByPair,
    getProjectPlan,
    addComment
} = require('../controllers/planController');

// All routes require authentication
router.post('/', protect, createPlan);
router.get('/:id', protect, getPlan);
router.put('/:id/version', protect, addVersion);
router.put('/:id/version/:versionIdx', protect, editVersion);
router.delete('/:id/version/:versionIdx', protect, deleteVersion);
router.get('/pair/:partnerId', protect, getPlanByPair);
router.get('/project/:projectId', protect, getProjectPlan);
router.post('/:id/version/:versionIdx/comment', protect, addComment);

module.exports = router;
