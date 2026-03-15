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
        
        // Locking for Student Leads: Uni, College, and Level are managed by Admin
        const isStudentLead = user.roles?.includes('studentLead');
        if (isStudentLead) {
            // Do not update these fields if user is a studentLead
            console.log(`Locking profile fields for Student Lead: ${user.username}`);
        } else {
            user.academicLevel = req.body.academicLevel || user.academicLevel;
            user.university = req.body.university || user.university;
            user.college = req.body.college || user.college;
        }

        user.bio = req.body.bio !== undefined ? req.body.bio : user.bio;
        user.gender = req.body.gender || user.gender;
        user.currentCompany = req.body.currentCompany || user.currentCompany;
        user.currentPosition = req.body.currentPosition || user.currentPosition;
        user.isPrivate = req.body.isPrivate !== undefined ? req.body.isPrivate : user.isPrivate;
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
    const {
        roles,
        lookingForPartner,
        search,
        university,
        major,
        academicLevel,
        city,
        country,
        currentCompany,
        currentPosition
    } = req.query;

    let query = {};

    if (roles) {
        query.roles = roles;
    }

    if (lookingForPartner === 'true') {
        query.lookingForPartner = true;
    }

    // Advanced Filters
    if (university) query.university = { $regex: university, $options: 'i' };
    if (major) query.major = { $regex: major, $options: 'i' };
    if (academicLevel) query.academicLevel = academicLevel;
    if (city) query.city = { $regex: city, $options: 'i' };
    if (country) query.country = { $regex: country, $options: 'i' };
    if (currentCompany) query.currentCompany = { $regex: currentCompany, $options: 'i' };
    if (currentPosition) query.currentPosition = { $regex: currentPosition, $options: 'i' };

    // Search by multiple fields (case-insensitive)
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { username: { $regex: search, $options: 'i' } },
            { skills: { $regex: search, $options: 'i' } },
            { major: { $regex: search, $options: 'i' } },
            { university: { $regex: search, $options: 'i' } }
        ];
        // If searching, ignore lookingFor filters to find specific users
        delete query.lookingForPartner;
    }

    // EXCLUDE BLOCKED USERS: Don't show users searcher has blocked
    if (req.user) {
        const currentUser = await User.findById(req.user.id);
        if (currentUser && currentUser.blockedUsers?.length > 0) {
            query._id = { ...query._id, $nin: currentUser.blockedUsers };
        }
    }

    const users = await User.find(query).select('-password');
    res.json(users);
};

// @desc    Block a user
// @route   POST /api/users/block/:id
// @access  Private
const blockUser = async (req, res) => {
    const userToBlock = await User.findById(req.params.id);
    if (!userToBlock) return res.status(404).json({ message: 'User not found' });

    if (req.user.id === req.params.id) {
        return res.status(400).json({ message: 'You cannot block yourself' });
    }

    const currentUser = await User.findById(req.user.id);
    if (currentUser.blockedUsers.includes(req.params.id)) {
        return res.status(400).json({ message: 'User already blocked' });
    }

    currentUser.blockedUsers.push(req.params.id);
    await currentUser.save();

    res.json({ message: 'User blocked successfully' });
};

// @desc    Unblock a user
// @route   DELETE /api/users/block/:id
// @access  Private
const unblockUser = async (req, res) => {
    const currentUser = await User.findById(req.user.id);
    currentUser.blockedUsers = currentUser.blockedUsers.filter(id => id.toString() !== req.params.id);
    await currentUser.save();
    res.json({ message: 'User unblocked successfully' });
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Public
const getUserById = async (req, res) => {
    const user = await User.findById(req.params.id)
        .select('-password')
        .populate('enrolledPartners.user', 'name username avatar role major academicLevel university');

    if (user) {
        // ===== BACKEND HEALING: Resync missed partnerships =====
        try {
            const Request = require('../models/Request');
            const acceptedRequests = await Request.find({
                $or: [{ sender: user._id }, { receiver: user._id }],
                type: { $in: ['partner', 'mentorship'] },
                status: 'accepted'
            });

            let changed = false;
            for (const reqObj of acceptedRequests) {
                const partnerId = reqObj.sender.toString() === user._id.toString() ? reqObj.receiver : reqObj.sender;
                if (!partnerId) continue;

                const isEnrolled = user.enrolledPartners.some(p => p.user && p.user._id.toString() === partnerId.toString());
                if (!isEnrolled) {
                    console.log(`[Healing] Adding missing partner ${partnerId} to user ${user.username}`);
                    user.enrolledPartners.push({ user: partnerId, status: 'active' });
                    changed = true;
                }
            }
            if (changed) await user.save();
        } catch (healError) {
            console.error('Healing error in getUserById:', healError);
        }
        // Privacy Check
        const isOwner = req.user && req.user._id.toString() === user._id.toString();
        if (user.isPrivate && !isOwner) {
            return res.status(403).json({ message: 'This profile is private' });
        }

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
        // ===== BACKEND HEALING: Resync missed partnerships =====
        try {
            const Request = require('../models/Request');
            const acceptedRequests = await Request.find({
                $or: [{ sender: user._id }, { receiver: user._id }],
                type: { $in: ['partner', 'mentorship'] },
                status: 'accepted'
            });

            let changed = false;
            for (const reqObj of acceptedRequests) {
                const partnerId = reqObj.sender.toString() === user._id.toString() ? reqObj.receiver : reqObj.sender;
                if (!partnerId) continue;

                const isEnrolled = user.enrolledPartners.some(p => p.user && p.user._id.toString() === partnerId.toString());
                if (!isEnrolled) {
                    console.log(`[Healing] Adding missing partner ${partnerId} to user ${user.username}`);
                    user.enrolledPartners.push({ user: partnerId, status: 'active' });
                    changed = true;
                }
            }
            if (changed) await user.save();
        } catch (healError) {
            console.error('Healing error in getUserByUsername:', healError);
        }
        // Privacy Check
        const isOwner = req.user && req.user._id.toString() === user._id.toString();
        if (user.isPrivate && !isOwner) {
            return res.status(403).json({ message: 'This profile is private' });
        }

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

// @desc    Get unique values for partner filters (dynamic dropdowns)
// @route   GET /api/users/filters
// @access  Public
const getUniquePartnerFilters = async (req, res) => {
    try {
        const query = { lookingForPartner: true };

        const [universities, majors, cities, countries, companies, positions] = await Promise.all([
            User.distinct('university', query),
            User.distinct('major', query),
            User.distinct('city', query),
            User.distinct('country', query),
            User.distinct('currentCompany', query),
            User.distinct('currentPosition', query)
        ]);

        res.json({
            University: universities.filter(Boolean),
            Major: majors.filter(Boolean),
            City: cities.filter(Boolean),
            Country: countries.filter(Boolean),
            Company: companies.filter(Boolean),
            Position: positions.filter(Boolean)
        });
    } catch (error) {
        console.error('Error fetching partner filters:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    updateUserProfile,
    getUsers,
    getUserById,
    getUserByUsername,
    topUpStars,
    blockUser,
    unblockUser,
    getUniquePartnerFilters
};
