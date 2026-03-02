const Recruitment = require('../models/Recruitment');

// @desc    Submit recruitment application
// @route   POST /api/recruitment
// @access  Private
const submitApplication = async (req, res) => {
    const { type, data } = req.body;

    if (!type || !data) {
        return res.status(400).json({ message: 'Please provide application type and data' });
    }

    try {
        const application = await Recruitment.create({
            user: req.user._id,
            type,
            data
        });

        res.status(201).json(application);
    } catch (error) {
        res.status(500).json({ message: 'Server error while submitting application' });
    }
};

// @desc    Get user applications
// @route   GET /api/recruitment/me
// @access  Private
const getMyApplications = async (req, res) => {
    try {
        const applications = await Recruitment.find({ user: req.user._id });
        res.json(applications);
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching applications' });
    }
};

module.exports = {
    submitApplication,
    getMyApplications
};
