const MentorshipRequest = require('../models/MentorshipRequest');

// @desc    Create mentorship request
// @route   POST /api/mentorship
// @access  Private (Student only?)
const createRequest = async (req, res) => {
    try {
        const { projectTitle, description, isPublic } = req.body;

        const request = await MentorshipRequest.create({
            student: req.user._id,
            projectTitle,
            description,
            isPublic: isPublic !== undefined ? isPublic : true,
        });

        res.status(201).json(request);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all mentorship requests
// @route   GET /api/mentorship
// @access  Private (Mentors only? or Public?)
const getRequests = async (req, res) => {
    try {
        const requests = await MentorshipRequest.find({})
            .populate('student', 'name email avatar bio')
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update request status
// @route   PUT /api/mentorship/:id
// @access  Private (Mentor only)
const updateRequestStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const request = await MentorshipRequest.findById(req.params.id);

        if (request) {
            request.status = status;
            const updatedRequest = await request.save();
            res.json(updatedRequest);
        } else {
            res.status(404).json({ message: 'Request not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createRequest,
    getRequests,
    updateRequestStatus,
};
