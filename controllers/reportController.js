const Report = require('../models/Report');

// @desc    Create a report
// @route   POST /api/reports
// @access  Private
const createReport = async (req, res) => {
    const { reportedUserId, reason, details } = req.body;

    if (!reportedUserId || !reason) {
        return res.status(400).json({ message: 'Reported user and reason are required' });
    }

    if (req.user.id === reportedUserId) {
        return res.status(400).json({ message: 'You cannot report yourself' });
    }

    const report = await Report.create({
        reporter: req.user.id,
        reportedUser: reportedUserId,
        reason,
        details
    });

    res.status(201).json({ message: 'Report submitted successfully', report });
};

// @desc    Get all reports (Admin only)
// @route   GET /api/reports
// @access  Private/Admin
const getReports = async (req, res) => {
    const reports = await Report.find({})
        .populate('reporter', 'name username')
        .populate('reportedUser', 'name username')
        .sort({ createdAt: -1 });

    res.json(reports);
};

module.exports = {
    createReport,
    getReports
};
