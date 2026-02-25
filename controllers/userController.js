const User = require('../models/User');

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        // Basic Info
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        user.username = req.body.username || user.username;
        user.socialLinks = req.body.socialLinks || user.socialLinks;
        user.skills = req.body.skills || user.skills;
        user.interests = req.body.interests || user.interests;

        // ===== STUDENT PROFILE FIELDS =====
        user.major = req.body.major || user.major;
        user.academicLevel = req.body.academicLevel || user.academicLevel;
        user.university = req.body.university || user.university;
        if (req.body.currentCourses) user.currentCourses = req.body.currentCourses;
        user.primaryStudyGoal = req.body.primaryStudyGoal || user.primaryStudyGoal;
        user.secondaryStudyGoal = req.body.secondaryStudyGoal || user.secondaryStudyGoal;
        user.fieldSpecificDetails = req.body.fieldSpecificDetails !== undefined ? req.body.fieldSpecificDetails : user.fieldSpecificDetails;
        user.preferredStudyStyle = req.body.preferredStudyStyle || user.preferredStudyStyle;
        user.studyPacePreference = req.body.studyPacePreference || user.studyPacePreference;
        if (req.body.availability) user.availability = req.body.availability;
        user.studyMode = req.body.studyMode || user.studyMode;
        if (req.body.preferredTools) user.preferredTools = req.body.preferredTools;
        user.communicationStyle = req.body.communicationStyle || user.communicationStyle;
        user.commitmentLevel = req.body.commitmentLevel || user.commitmentLevel;
        if (req.body.languages) user.languages = req.body.languages;
        user.accessibilityPreferences = req.body.accessibilityPreferences || user.accessibilityPreferences;
        user.learningTraits = req.body.learningTraits || user.learningTraits;
        user.studyNote = req.body.studyNote !== undefined ? req.body.studyNote : user.studyNote;
        if (req.body.lookingForPartner !== undefined) user.lookingForPartner = req.body.lookingForPartner;

        if (req.body.pitchQuestions) user.pitchQuestions = req.body.pitchQuestions;
        if (req.body.planTemplate !== undefined) user.planTemplate = req.body.planTemplate;

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            pitchQuestions: updatedUser.pitchQuestions,
            planTemplate: updatedUser.planTemplate,
            token: req.headers.authorization.split(' ')[1],
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Get all users (with filters)
// @route   GET /api/users
// @access  Public
const getUsers = async (req, res) => {
    const { role, lookingForPartner, search } = req.query;
    let query = {};

    if (role) {
        query.role = role;
    }

    if (lookingForPartner === 'true') {
        query.lookingForPartner = true;
    }

    // Search by multiple fields (case-insensitive)
    if (search) {
        query.$or = [
            { username: { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
            { university: { $regex: search, $options: 'i' } },
            { major: { $regex: search, $options: 'i' } },
            { skills: { $regex: search, $options: 'i' } },
            { interests: { $regex: search, $options: 'i' } }
        ];
        // If searching, ignore lookingFor filters to find specific users
        delete query.lookingForPartner;
    }

    const users = await User.find(query).select('-password');
    res.json(users);
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Public
const getUserById = async (req, res) => {
    const user = await User.findById(req.params.id)
        .select('-password')
        .populate('enrolledPartners.user', 'name username avatar role major academicLevel university');

    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Get user by Username (Public Profile)
// @route   GET /api/users/u/:username
// @access  Public
const getUserByUsername = async (req, res) => {
    const user = await User.findOne({ username: req.params.username })
        .select('-password')
        .populate('enrolledPartners.user', 'name username avatar role major academicLevel university');

    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Top up stars (V2.0 - Dummy Implementation)
// @route   POST /api/users/topup
// @access  Private
const topUpStars = async (req, res) => {
    try {
        const { amount } = req.body; // Amount of stars to add
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        // Dummy implementation: Just add stars without payment processing
        user.stars += amount;
        await user.save();

        res.json({
            message: `Successfully topped up ${amount} stars`,
            stars: user.stars
        });
    } catch (error) {
        console.error('Top up error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    updateUserProfile,
    getUsers,
    getUserById,
    getUserByUsername,
    topUpStars,
};
