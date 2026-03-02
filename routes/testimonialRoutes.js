const express = require('express');
const router = express.Router();
const { addTestimonial, getTestimonials } = require('../controllers/testimonialController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, addTestimonial);
router.get('/', getTestimonials);

module.exports = router;
