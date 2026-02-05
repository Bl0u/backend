const Review = require('../models/Review');
const Request = require('../models/Request');
const User = require('../models/User');

// @desc    Add a review
// @route   POST /api/reviews
// @access  Private
const addReview = async (req, res) => {
    const { recipientId, type, rating, comment } = req.body;

    if (req.user.id === recipientId) {
        return res.status(400).json({ message: 'Cannot review yourself' });
    }

    // 1. Check if Connection Exists (Status accepted)
    // For mentorship: Sender(Student) -> Receiver(Mentor) or vice versa?
    // User said: "if a user accepted a partner match... only if they accepted each other, they can leave a review".
    // "mentor can leave review on the student profile and same goes for student"
    // So we check for an Accepted Request between these two users, regardless of who sent it.

    const connection = await Request.findOne({
        $or: [
            { sender: req.user.id, receiver: recipientId, status: 'accepted' },
            { sender: recipientId, receiver: req.user.id, status: 'accepted' }
        ]
    });

    if (!connection) {
        return res.status(400).json({ message: 'You must have an accepted connection (Mentorship or Partner) to leave a review.' });
    }

    // 2. Check if already reviewed? (Optional, usually 1 review per connection? For now allow multiple or 1?)
    // Let's prevent spam -> 1 review per type per user pair?
    const existingReview = await Review.findOne({
        reviewer: req.user.id,
        recipient: recipientId,
        type
    });

    if (existingReview) {
        return res.status(400).json({ message: 'You have already reviewed this user.' });
    }

    const review = await Review.create({
        reviewer: req.user.id,
        recipient: recipientId,
        type,
        rating,
        comment
    });

    res.status(201).json(review);
};

// @desc    Get reviews for a user
// @route   GET /api/reviews/:userId
// @access  Public
const getReviews = async (req, res) => {
    const reviews = await Review.find({ recipient: req.params.userId })
        .populate('reviewer', 'name username avatar role')
        .sort({ createdAt: -1 });
    res.json(reviews);
};

module.exports = {
    addReview,
    getReviews
};
