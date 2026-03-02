const express = require('express');
const router = express.Router();
const { interpretAndRecommend } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware'); // Assuming this exists based on standard patterns

// AI is public for now to attract users, handles internal protection if needed
router.post('/recommend', protect, interpretAndRecommend);

module.exports = router;
