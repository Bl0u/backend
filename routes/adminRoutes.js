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
    promoteUser
} = require('../controllers/adminController');

// All routes require protect + adminOnly
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

// Database Reset (DANGER)
router.delete('/reset', resetDatabase);

module.exports = router;
