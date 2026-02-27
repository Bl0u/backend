const User = require('../models/User');
const Thread = require('../models/Thread');
const Post = require('../models/Post');

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        // Basic Info
        // ===== STUDENT PROFILE 1.2 (LEAN) =====
        // 1️⃣ Core Identity
        user.name = req.body.name || user.name;
        user.username = req.body.username || user.username;
        user.major = req.body.major || user.major;
        user.academicLevel = req.body.academicLevel || user.academicLevel;
        user.university = req.body.university || user.university;
        user.bio = req.body.bio !== undefined ? req.body.bio : user.bio;
        user.socialLinks = req.body.socialLinks || user.socialLinks;

        // 2️⃣ Partner Needs
        user.partnerType = req.body.partnerType || user.partnerType;
        user.matchingGoal = req.body.matchingGoal || user.matchingGoal;
        if (req.body.topics) user.topics = req.body.topics;
        user.neededFromPartner = req.body.neededFromPartner !== undefined ? req.body.neededFromPartner : user.neededFromPartner;

        // 3️⃣ Location & Logistics
        user.timezone = req.body.timezone || user.timezone;
        if (req.body.languages) user.languages = req.body.languages;
        user.studyMode = req.body.studyMode || user.studyMode;
        if (req.body.preferredTools) user.preferredTools = req.body.preferredTools;

        // 4️⃣ Availability & Commitment
        if (req.body.availability) {
            user.availability = {
                days: req.body.availability.days || user.availability.days,
                timeRanges: req.body.availability.timeRanges || user.availability.timeRanges
            };
        }
        user.commitmentLevel = req.body.commitmentLevel || user.commitmentLevel;

        // 5️⃣ Style & Offsets
        user.sessionsPerWeek = req.body.sessionsPerWeek || user.sessionsPerWeek;
        user.sessionLength = req.body.sessionLength || user.sessionLength;
        user.pace = req.body.pace || user.pace;
        user.canOffer = req.body.canOffer !== undefined ? req.body.canOffer : user.canOffer;

        // Common/Matching
        user.skills = req.body.skills || user.skills;
        user.interests = req.body.interests || user.interests;
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
        // Calculate Statistics
        const [threadsCreated, guidesCreated, commentsMade] = await Promise.all([
            Thread.countDocuments({ author: req.params.id }),
            Thread.countDocuments({ author: req.params.id, isCurated: true }),
            Post.countDocuments({ author: req.params.id })
        ]);

        const stats = {
            threadsCreated,
            guidesCreated,
            communityThreads: threadsCreated - guidesCreated,
            commentsMade
        };

        const userObj = user.toObject();
        userObj.stats = stats;

        res.json(userObj);
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
        // Calculate Statistics
        const [threadsCreated, guidesCreated, commentsMade] = await Promise.all([
            Thread.countDocuments({ author: user._id }),
            Thread.countDocuments({ author: user._id, isCurated: true }),
            Post.countDocuments({ author: user._id })
        ]);

        const stats = {
            threadsCreated,
            guidesCreated,
            communityThreads: threadsCreated - guidesCreated,
            commentsMade
        };

        const userObj = user.toObject();
        userObj.stats = stats;

        res.json(userObj);
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
