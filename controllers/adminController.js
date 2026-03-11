const User = require('../models/User');
const Thread = require('../models/Thread');
const Post = require('../models/Post');
const Report = require('../models/Report');
const Payment = require('../models/Payment');
const Recruitment = require('../models/Recruitment');
const Message = require('../models/Message');
const Request = require('../models/Request');
const Review = require('../models/Review');
const Plan = require('../models/Plan');
const PitchConfig = require('../models/PitchConfig');

// ==============================
// OVERVIEW / STATS
// ==============================

// @desc    Get dashboard overview stats
// @route   GET /api/admin/stats
// @access  Admin
const getStats = async (req, res) => {
    try {
        const [
            totalUsers,
            bannedUsers,
            totalThreads,
            totalPosts,
            totalPayments,
            pendingReports,
            totalReports,
            totalRecruitment,
            pendingRecruitment
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isBanned: true }),
            Thread.countDocuments(),
            Post.countDocuments(),
            Payment.countDocuments({ status: 'success' }),
            Report.countDocuments({ status: 'pending' }),
            Report.countDocuments(),
            Recruitment.countDocuments(),
            Recruitment.countDocuments({ status: 'pending' })
        ]);

        // Stars in circulation
        const starsAgg = await User.aggregate([
            { $group: { _id: null, totalStars: { $sum: '$stars' } } }
        ]);
        const starsInCirculation = starsAgg.length > 0 ? starsAgg[0].totalStars : 0;

        // Revenue (sum of successful payments)
        const revenueAgg = await Payment.aggregate([
            { $match: { status: 'success' } },
            { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
        ]);
        const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

        res.json({
            totalUsers,
            bannedUsers,
            totalThreads,
            totalPosts,
            totalPayments,
            pendingReports,
            totalReports,
            totalRecruitment,
            pendingRecruitment,
            starsInCirculation,
            totalRevenue
        });
    } catch (error) {
        console.error('Admin getStats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==============================
// USERS
// ==============================

// @desc    Get all users with search/filter/pagination
// @route   GET /api/admin/users?search=&page=&limit=
// @access  Admin
const getUsers = async (req, res) => {
    try {
        const { search, page = 1, limit = 20, banned } = req.query;
        const query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        if (banned === 'true') query.isBanned = true;
        if (banned === 'false') query.isBanned = { $ne: true };

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            User.countDocuments(query)
        ]);

        res.json({
            users,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('Admin getUsers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Promote user to new role
// @route   PUT /api/admin/users/:id/promote
// @access  Admin
const promoteUser = async (req, res) => {
    try {
        const { role, university, college, academicLevel } = req.body;
        const validRoles = ['student', 'admin', 'mentor', 'studentLead'];

        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Safety: Prevent self-demotion from admin
        if (user._id.toString() === req.user._id.toString() && role !== 'admin') {
            return res.status(403).json({ message: 'You cannot demote yourself from admin role' });
        }

        user.role = role;

        // Targeted fields for studentLead/mentor
        if (role === 'studentLead') {
            if (university) user.university = university;
            if (college) user.college = college;
            if (academicLevel) user.academicLevel = academicLevel;
        }

        await user.save();

        res.json({
            message: `User promoted to ${role} successfully`,
            user: {
                _id: user._id,
                name: user.name,
                role: user.role,
                university: user.university,
                college: user.college,
                academicLevel: user.academicLevel
            }
        });
    } catch (error) {
        console.error('Admin promoteUser error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get single user details with all related data
// @route   GET /api/admin/users/:id
// @access  Admin
const getUserDetails = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('enrolledPartners.user', 'name username')
            .populate('activePlans');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get user's threads
        const threads = await Thread.find({ author: user._id })
            .select('title type views isPaid price createdAt upvotes')
            .sort({ createdAt: -1 });

        // Get user's posts count
        const postsCount = await Post.countDocuments({ author: user._id });

        // Get reports against this user
        const reportsAgainst = await Report.find({ reportedUser: user._id })
            .populate('reporter', 'name username')
            .sort({ createdAt: -1 });

        // Get reports by this user
        const reportsMade = await Report.countDocuments({ reporter: user._id });

        // Get payment history
        const payments = await Payment.find({ user: user._id })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({
            user,
            threads,
            postsCount,
            reportsAgainst,
            reportsMade,
            payments
        });
    } catch (error) {
        console.error('Admin getUserDetails error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a user and all associated data
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'admin') {
            return res.status(400).json({ message: 'Cannot delete an admin account' });
        }

        // Delete user's posts
        await Post.deleteMany({ author: user._id });

        // Delete user's threads
        await Thread.deleteMany({ author: user._id });

        // Delete user's messages
        await Message.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] });

        // Delete user's reports (both made and received)
        await Report.deleteMany({ $or: [{ reporter: user._id }, { reportedUser: user._id }] });

        // Delete user's payments
        await Payment.deleteMany({ user: user._id });

        // Delete user's requests
        await Request.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] });

        // Delete user's reviews
        await Review.deleteMany({ $or: [{ reviewer: user._id }, { recipient: user._id }] });

        // Delete user's recruitment applications
        await Recruitment.deleteMany({ user: user._id });

        // Delete the user
        await User.findByIdAndDelete(user._id);

        res.json({ message: `User ${user.username} and all associated data deleted` });
    } catch (error) {
        console.error('Admin deleteUser error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Ban or unban a user
// @route   PUT /api/admin/users/:id/ban
// @access  Admin
const toggleBan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'admin') {
            return res.status(400).json({ message: 'Cannot ban an admin account' });
        }

        user.isBanned = !user.isBanned;
        await user.save();

        res.json({
            message: user.isBanned ? `User ${user.username} has been banned` : `User ${user.username} has been unbanned`,
            isBanned: user.isBanned
        });
    } catch (error) {
        console.error('Admin toggleBan error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Adjust a user's star balance
// @route   PUT /api/admin/users/:id/stars
// @access  Admin
const adjustStars = async (req, res) => {
    try {
        const { amount } = req.body; // Can be positive (add) or negative (deduct)

        if (amount === undefined || typeof amount !== 'number') {
            return res.status(400).json({ message: 'Amount is required and must be a number' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newBalance = user.stars + amount;
        if (newBalance < 0) {
            return res.status(400).json({ message: 'Cannot set stars below 0' });
        }

        user.stars = newBalance;
        await user.save();

        res.json({
            message: `Stars adjusted by ${amount}. New balance: ${newBalance}`,
            stars: newBalance
        });
    } catch (error) {
        console.error('Admin adjustStars error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==============================
// THREADS
// ==============================

// @desc    Get all threads with search/filter
// @route   GET /api/admin/threads?search=&type=&page=&limit=
// @access  Admin
const getThreads = async (req, res) => {
    try {
        const { search, type, page = 1, limit = 20 } = req.query;
        const query = {};

        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }
        if (type) {
            query.type = type;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [threads, total] = await Promise.all([
            Thread.find(query)
                .populate('author', 'name username avatar')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Thread.countDocuments(query)
        ]);

        res.json({
            threads,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('Admin getThreads error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a thread and all its posts
// @route   DELETE /api/admin/threads/:id
// @access  Admin
const deleteThread = async (req, res) => {
    try {
        const thread = await Thread.findById(req.params.id);
        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // Delete all posts in the thread
        await Post.deleteMany({ thread: thread._id });

        // Delete the thread
        await Thread.findByIdAndDelete(thread._id);

        res.json({ message: `Thread "${thread.title}" and all its posts deleted` });
    } catch (error) {
        console.error('Admin deleteThread error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==============================
// REPORTS
// ==============================

// @desc    Get all reports with populated data
// @route   GET /api/admin/reports?status=
// @access  Admin
const getReports = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        const reports = await Report.find(query)
            .populate('reporter', 'name username avatar email')
            .populate('reportedUser', 'name username avatar email isBanned stars')
            .sort({ createdAt: -1 });

        res.json(reports);
    } catch (error) {
        console.error('Admin getReports error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update report status (reviewed/dismissed) with optional ban
// @route   PUT /api/admin/reports/:id
// @access  Admin
const updateReport = async (req, res) => {
    try {
        const { status, banUser } = req.body;

        const report = await Report.findById(req.params.id)
            .populate('reportedUser', 'name username');

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        if (!['reviewed', 'dismissed'].includes(status)) {
            return res.status(400).json({ message: 'Status must be "reviewed" or "dismissed"' });
        }

        report.status = status;
        await report.save();

        // Optionally ban the reported user
        if (banUser && report.reportedUser) {
            await User.findByIdAndUpdate(report.reportedUser._id, { isBanned: true });
        }

        res.json({
            message: `Report ${status}${banUser ? ' and user banned' : ''}`,
            report
        });
    } catch (error) {
        console.error('Admin updateReport error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==============================
// PAYMENTS
// ==============================

// @desc    Get all payments
// @route   GET /api/admin/payments?status=&page=&limit=
// @access  Admin
const getPayments = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [payments, total] = await Promise.all([
            Payment.find(query)
                .populate('user', 'name username email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Payment.countDocuments(query)
        ]);

        res.json({
            payments,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('Admin getPayments error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==============================
// RECRUITMENT
// ==============================

// @desc    Get all recruitment applications
// @route   GET /api/admin/recruitment?status=
// @access  Admin
const getRecruitment = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        const applications = await Recruitment.find(query)
            .populate('user', 'name username email avatar')
            .sort({ createdAt: -1 });

        res.json(applications);
    } catch (error) {
        console.error('Admin getRecruitment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update recruitment application status
// @route   PUT /api/admin/recruitment/:id
// @access  Admin
const updateRecruitment = async (req, res) => {
    try {
        const { status } = req.body;

        if (!['reviewed', 'accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const application = await Recruitment.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate('user', 'name username email');

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        res.json({ message: `Application ${status}`, application });
    } catch (error) {
        console.error('Admin updateRecruitment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==============================
// DATABASE RESET
// ==============================

// @desc    Wipe entire database except admin accounts
// @route   DELETE /api/admin/reset
// @access  Admin
const resetDatabase = async (req, res) => {
    try {
        const { confirmation } = req.body;

        // Require explicit confirmation string to prevent accidental wipes
        if (confirmation !== 'RESET_EVERYTHING') {
            return res.status(400).json({ message: 'Confirmation string required: "RESET_EVERYTHING"' });
        }

        // Import remaining models for full wipe
        const Testimonial = require('../models/Testimonial');
        const ReviewRequest = require('../models/ReviewRequest');

        // Delete everything except admin users
        const results = await Promise.all([
            User.deleteMany({ role: { $ne: 'admin' } }),
            Thread.deleteMany({}),
            Post.deleteMany({}),
            Message.deleteMany({}),
            Report.deleteMany({}),
            Payment.deleteMany({}),
            Request.deleteMany({}),
            Review.deleteMany({}),
            Recruitment.deleteMany({}),
            Plan.deleteMany({}),
            Testimonial.deleteMany({}),
            ReviewRequest.deleteMany({})
        ]);

        const labels = [
            'Users (non-admin)', 'Threads', 'Posts', 'Messages',
            'Reports', 'Payments', 'Requests', 'Reviews',
            'Recruitment', 'Plans', 'Testimonials', 'ReviewRequests'
        ];

        const summary = labels.map((label, i) => ({
            collection: label,
            deleted: results[i].deletedCount
        }));

        // Reset admin stars to default
        await User.updateMany({ role: 'admin' }, {
            $set: {
                purchasedThreads: [],
                pinnedThreads: [],
                blockedUsers: [],
                enrolledPartners: [],
                activePlans: [],
                partnerHistory: []
            }
        });

        console.log('🔴 DATABASE RESET by admin:', req.user.username);

        res.json({
            message: 'Database has been reset. All data wiped except admin accounts.',
            summary
        });
    } catch (error) {
        console.error('Admin resetDatabase error:', error);
        res.status(500).json({ message: 'Server error during reset' });
    }
};

// ==============================
// PITCH HUB CONFIG
// ==============================

// @desc    Get global pitch configuration
// @route   GET /api/admin/pitch-config
// @access  Admin
const getPitchConfig = async (req, res) => {
    try {
        let config = await PitchConfig.findOne();
        if (!config) {
            // Return default/empty if none exists
            config = { categories: [], questions: [] };
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update global pitch configuration
// @route   PUT /api/admin/pitch-config
// @access  Admin
const updatePitchConfig = async (req, res) => {
    try {
        const { categories, questions, rolesEnabled } = req.body;
        let config = await PitchConfig.findOne();

        if (config) {
            config.categories = categories;
            config.questions = questions;
            config.rolesEnabled = rolesEnabled;
            await config.save();
        } else {
            config = await PitchConfig.create({ categories, questions, rolesEnabled });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all project pitches for management
// @route   GET /api/admin/pitches
// @access  Admin
const getPitchesAdmin = async (req, res) => {
    try {
        const pitches = await Request.find({ isPublic: true })
            .populate('sender', 'name username')
            .sort({ createdAt: -1 });
        res.json(pitches);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a project pitch (Admin)
// @route   DELETE /api/admin/pitches/:id
// @access  Admin
const deletePitchAdmin = async (req, res) => {
    try {
        const pitch = await Request.findById(req.params.id);
        if (!pitch) {
            return res.status(404).json({ message: 'Pitch not found' });
        }

        // Delete the pitch
        await Request.findByIdAndDelete(req.params.id);

        // Optional: Clean up related pitch_claims
        await Request.deleteMany({ pitchRef: req.params.id, type: 'pitch_claim' });

        res.json({ message: 'Pitch and related claims removed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getStats,
    getUsers,
    getUserDetails,
    deleteUser,
    toggleBan,
    adjustStars,
    getThreads,
    deleteThread,
    getReports,
    updateReport,
    getPayments,
    getRecruitment,
    updateRecruitment,
    resetDatabase,
    promoteUser,
    getPitchConfig,
    updatePitchConfig,
    getPitchesAdmin,
    deletePitchAdmin
};
