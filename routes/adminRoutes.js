const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
    getStats,
    getUsers,
    getUserDetails,
    deleteUser,
    toggleBan,
    adjustStars,
    getThreads,
    deleteThread,
    getReports,
    updateReport,
    getPayments,
    getRecruitment,
    updateRecruitment,
    resetDatabase,
    promoteUser,
    getPitchConfig,
    updatePitchConfig,
    getPitchesAdmin,
    deletePitchAdmin
} = require('../controllers/adminController');

// Public config GET (still protected by session/token if desired, but not adminOnly)
router.get('/pitch-config', protect, getPitchConfig);

// All routes below require protect + adminOnly
router.use(protect, adminOnly);

// Overview
router.get('/stats', getStats);

// Users
router.get('/users', getUsers);
router.get('/users/:id', getUserDetails);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/ban', toggleBan);
router.put('/users/:id/stars', adjustStars);
router.put('/users/:id/promote', promoteUser);

// Threads
router.get('/threads', getThreads);
router.delete('/threads/:id', deleteThread);

// Reports
router.get('/reports', getReports);
router.put('/reports/:id', updateReport);

// Payments
router.get('/payments', getPayments);

// Recruitment
router.get('/recruitment', getRecruitment);
router.put('/recruitment/:id', updateRecruitment);

// Pitch Hub Config
router.put('/pitch-config', updatePitchConfig);

// Pitch Hub management
router.get('/pitches', getPitchesAdmin);
router.delete('/pitches/:id', deletePitchAdmin);

// Database Reset (DANGER)
router.delete('/reset', resetDatabase);

module.exports = router;
