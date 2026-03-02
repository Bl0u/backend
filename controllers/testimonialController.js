const Testimonial = require('../models/Testimonial');

// @desc    Add a testimonial
// @route   POST /api/testimonials
// @access  Private
const addTestimonial = async (req, res) => {
    try {
        const { rating, comment } = req.body;

        if (!rating || !comment) {
            return res.status(400).json({ message: 'Rating and comment are required' });
        }

        const testimonial = await Testimonial.create({
            user: req.user.id,
            rating,
            comment
        });

        res.status(201).json(testimonial);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all approved testimonials
// @route   GET /api/testimonials
// @access  Public
const getTestimonials = async (req, res) => {
    try {
        const testimonials = await Testimonial.find({ status: 'approved' })
            .populate('user', 'name username profilePicture')
            .sort({ createdAt: -1 });
        res.json(testimonials);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    addTestimonial,
    getTestimonials
};
