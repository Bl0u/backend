const express = require('express');
const router = express.Router();
const {
    createRequest,
    getRequests,
    updateRequestStatus,
} = require('../controllers/mentorshipController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createRequest)
    .get(protect, getRequests); // Protect to ensure only logged in users see (or restrict to mentor role in controller)

router.route('/:id').put(protect, updateRequestStatus);

module.exports = router;
