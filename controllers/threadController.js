const Thread = require('../models/Thread');

// @desc    Create a new thread/resource
// @route   POST /api/threads
// @access  Private
const createThread = async (req, res) => {
    try {
        const { title, content, type } = req.body;
        let attachments = [];

        if (req.file) {
            // Store relative path to access via static route
            attachments.push(`/uploads/${req.file.filename}`);
        }

        const thread = await Thread.create({
            author: req.user._id,
            title,
            content,
            type: type || 'discussion',
            attachments,
        });

        res.status(201).json(thread);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all threads
// @route   GET /api/threads
// @access  Public (or Private? "user or mentor can create... publish info". Usually resources hub is visible to logged in users.)
//          Let's make it Public for visibility potential, or Private. 
//          Since it's a closed community usually, let's keep it open or require login? 
//          User said "resources hub -> fixed and dynamic". Let's assume Public access allowed but Creating requires login.
const getThreads = async (req, res) => {
    try {
        const threads = await Thread.find({})
            .populate('author', 'name avatar role') // Join author info
            .sort({ createdAt: -1 });
        res.json(threads);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createThread,
    getThreads,
};
