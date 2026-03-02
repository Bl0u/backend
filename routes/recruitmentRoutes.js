const express = require('express');
const router = express.Router();
const { submitApplication, getMyApplications } = require('../controllers/recruitmentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, submitApplication);
router.get('/me', protect, getMyApplications);

module.exports = router;
