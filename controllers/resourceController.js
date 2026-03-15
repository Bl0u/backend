const mongoose = require('mongoose');
const Thread = require('../models/Thread');
const Post = require('../models/Post');

// @desc    Create a new thread
// @route   POST /api/resources/thread
// @access  Private
const createThread = async (req, res) => {
    try {
        const { title, description, content, tags, type, isCurated, isPaid, price, university, college, academicLevel } = req.body;

        let attachments = [];
        if (req.file) {
            attachments.push(`/uploads/${req.file.filename}`);
        }

        const thread = await Thread.create({
            author: req.user._id,
            title,
            description,
            content,
            tags: typeof tags === 'string' ? JSON.parse(tags) : tags, // Handle FormData stringification
            type,
            isCurated: isCurated === 'true' || isCurated === true,
            attachments,
            // V2.0: Monetization
            isPaid: isPaid === 'true' || isPaid === true,
            price: isPaid ? parseInt(price) || 0 : 0,

            // V2.1: Targeting
            university,
            college,
            academicLevel
        });

        res.status(201).json(thread);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all threads (with filters)
// @route   GET /api/resources
// @access  Public
const getThreads = async (req, res) => {
    try {
        const { search, tag, tags, curated, author } = req.query;
        let query = {};

        if (author) {
            query.author = new mongoose.Types.ObjectId(author);
        }

        if (curated === 'true') {
            query.isCurated = true;
        } else if (curated === 'false') {
            query.isCurated = false;
        }

        // Support single tag (legacy) or multiple tags
        if (tags) {
            const tagsArray = tags.split(',').map(t => t.startsWith('#') ? t : `#${t}`);
            query.tags = { $all: tagsArray };
            delete query.isCurated; // 1.7 Fix: If filtering by tags, ignore tab constraints
        } else if (tag) {
            query.tags = tag.startsWith('#') ? tag : `#${tag}`;
            delete query.isCurated; // 1.7 Fix
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
            // If searching, ignore curated filter to show all results
            delete query.isCurated;
        }

        // Use aggregation to get counts
        const threads = await Thread.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'posts',
                    localField: '_id',
                    foreignField: 'thread',
                    as: 'posts'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            { $unwind: '$author' },
            {
                $project: {
                    title: 1,
                    description: 1,
                    content: 1,
                    tags: 1,
                    type: 1,
                    isCurated: 1,
                    isPaid: 1, // V2.0: Include monetization fields
                    price: 1,  // V2.0
                    purchasesCount: { $size: { $ifNull: ['$purchasers', []] } },
                    attachments: 1, // Include attachments
                    createdAt: 1,
                    'author.name': 1,
                    'author.username': 1,
                    'author.avatar': 1, // Include avatar
                    postCount: { $size: '$posts' },
                    upvoteCount: { $sum: '$posts.upvoteCount' }
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        res.json(threads);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get thread details and posts
// @route   GET /api/resources/thread/:id
// @access  Public
const getThreadDetail = async (req, res) => {
    try {
        const thread = await Thread.findById(req.params.id)
            .populate('author', 'name username avatar')
            .populate('moderators', 'name username avatar');
        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // V2.0: Access Control for Paid Threads
        let hasAccess = true;
        const userId = req.user?._id?.toString();

        if (thread.isPaid) {
            if (!userId) {
                // Not logged in, no access to paid content
                hasAccess = false;
            } else {
                // Check if user is author or moderator first
                const isAuthor = thread.author._id.toString() === userId;
                const isModerator = thread.moderators.some(mod => mod._id.toString() === userId);

                if (isAuthor || isModerator) {
                    // Thread owners and moderators always have access
                    hasAccess = true;
                } else {
                    // For regular users, check if they purchased
                    const User = require('../models/User');
                    const user = await User.findById(userId);
                    const hasPurchased = user?.purchasedThreads?.includes(req.params.id);
                    hasAccess = hasPurchased;
                }

                // V2.1: Student Lead Targeted Resources Access Bypass
                if (!hasAccess) {
                    const User = require('../models/User');
                    const user = await User.findById(userId);
                    
                    if (user && user.roles && user.roles.includes('studentLead')) {
                        // If the thread has defined demographic targets, they must match the user's details if set.
                        const isTargeted = thread.university || thread.college || thread.academicLevel;
                        let userMatches = true;

                        // Case-insensitive comparisons for robustness
                        const normalize = (str) => str ? str.trim().toLowerCase() : '';

                        if (thread.university && normalize(thread.university) !== normalize(user.university)) userMatches = false;
                        if (thread.college && normalize(thread.college) !== normalize(user.college)) userMatches = false;
                        if (thread.academicLevel && normalize(thread.academicLevel) !== normalize(user.academicLevel)) userMatches = false;
                        
                        // Grant free access
                        if (userMatches) {
                            hasAccess = true;
                        }
                    }
                }
            }
        }

        const posts = await Post.find({ thread: req.params.id })
            .populate('author', 'name username avatar')
            .sort({ upvoteCount: -1, createdAt: 1 });

        // Check if thread is pinned by the user
        let isPinned = false;
        if (req.user) {
            const User = require('../models/User');
            const user = await User.findById(req.user._id);
            isPinned = user?.pinnedThreads?.includes(req.params.id);
        }

        res.json({ thread, posts, hasAccess, isPinned }); // Include isPinned flag for frontend
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Add a post to a thread
// @route   POST /api/resources/thread/:id/post
// @access  Private
const addPost = async (req, res) => {
    try {
        const { contentType, content } = req.body;
        const threadId = req.params.id;

        const thread = await Thread.findById(threadId);
        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        let attachments = [];
        if (req.file) {
            attachments.push(`/uploads/${req.file.filename}`);
        }

        const post = await Post.create({
            thread: threadId,
            author: req.user._id,
            contentType,
            content,
            attachments,
            parentPost: req.body.parentPost || null
        });

        // Follow-up Logic 1.0: Handle notifications
        const User = require('../models/User');
        const Request = require('../models/Request');
        const postAuthor = await User.findById(req.user._id);
        const isReply = !!req.body.parentPost;

        if (isReply) {
            // Logic 2: Notify author of the msg being replied to
            const parentPost = await Post.findById(req.body.parentPost);
            if (parentPost && parentPost.author.toString() !== req.user._id.toString()) {
                await Request.create({
                    sender: req.user._id,
                    receiver: parentPost.author,
                    type: 'notification',
                    message: `${postAuthor.name} replied to ur msg at thread "${thread.title}"|||THREAD:${threadId}`,
                    status: 'accepted',
                    isPublic: false
                });
            }
        } else {
            // Logic 1: Notify users who pinned the thread (for main comments only)
            const pinnedUsers = await User.find({ pinnedThreads: threadId });

            for (const pinnedUser of pinnedUsers) {
                // Don't notify the sender
                if (pinnedUser._id.toString() === req.user._id.toString()) continue;

                await Request.create({
                    sender: req.user._id,
                    receiver: pinnedUser._id,
                    type: 'notification',
                    message: `${postAuthor.name} posted "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}" in thread "${thread.title}"|||THREAD:${threadId}`,
                    status: 'accepted',
                    isPublic: false
                });
            }
        }

        res.status(201).json(post);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Toggle upvote on a post
// @route   PUT /api/resources/post/:id/upvote
// @access  Private
const toggleUpvote = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const userId = req.user._id.toString();
        const alreadyUpvoted = post.upvotes.includes(userId);

        if (alreadyUpvoted) {
            post.upvotes = post.upvotes.filter(id => id.toString() !== userId);
        } else {
            post.upvotes.push(userId);
        }

        post.upvoteCount = post.upvotes.length;
        await post.save();

        res.json({ upvoteCount: post.upvoteCount, alreadyUpvoted: !alreadyUpvoted });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update thread (title/tags)
// @route   PUT /api/resources/thread/:id
// @access  Private
const updateThread = async (req, res) => {
    try {
        const { title, tags, university, college, academicLevel } = req.body;
        const thread = await Thread.findById(req.params.id);

        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // Check if owner or moderator
        const isOwner = thread.author.toString() === req.user._id.toString();
        const isMod = thread.moderators.some(mod => mod.toString() === req.user._id.toString());

        if (!isOwner && !isMod) {
            return res.status(403).json({ message: 'Not authorized to edit this thread' });
        }

        if (title) thread.title = title;
        if (tags) thread.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        if (university !== undefined) thread.university = university;
        if (college !== undefined) thread.college = college;
        if (academicLevel !== undefined) thread.academicLevel = academicLevel;

        await thread.save();
        res.json(thread);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update thread price (V2.0)
// @route   PUT /api/resources/thread/:id/price
// @access  Private (Owner only)
const updateThreadPrice = async (req, res) => {
    try {
        const { price, isPaid } = req.body;
        const thread = await Thread.findById(req.params.id);

        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // Only owner can change price
        const isOwner = thread.author.toString() === req.user._id.toString();
        if (!isOwner) {
            return res.status(403).json({ message: 'Only the thread owner can change pricing' });
        }

        // Update pricing
        thread.isPaid = isPaid !== undefined ? isPaid : thread.isPaid;
        thread.price = isPaid ? (parseInt(price) || 0) : 0;

        await thread.save();
        res.json({ message: 'Pricing updated successfully', thread });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete thread
// @route   DELETE /api/resources/thread/:id
// @access  Private
const deleteThread = async (req, res) => {
    try {
        const thread = await Thread.findById(req.params.id);
        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // Only owner can delete
        if (thread.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the author can delete this thread' });
        }

        await Thread.deleteOne({ _id: req.params.id });
        await Post.deleteMany({ thread: req.params.id }); // Clean up posts

        res.json({ message: 'Thread deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Add moderator to thread
// @route   POST /api/resources/thread/:id/moderator
// @access  Private
const addModerator = async (req, res) => {
    try {
        const { username } = req.body;
        const thread = await Thread.findById(req.params.id);

        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // Only owner can add mods
        if (thread.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the author can grant moderator privileges' });
        }

        const User = require('../models/User');
        const userToAdd = await User.findOne({ username });

        if (!userToAdd) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (thread.moderators.includes(userToAdd._id)) {
            return res.status(400).json({ message: 'User is already a moderator' });
        }

        thread.moderators.push(userToAdd._id);
        await thread.save();

        // Notify the user they've been made a moderator
        const Request = require('../models/Request');
        await Request.create({
            sender: req.user._id,
            receiver: userToAdd._id,
            type: 'notification',
            message: `You have been granted moderator privileges on the thread "${thread.title}"|||THREAD:${thread.id}`,
            status: 'accepted',
            isPublic: false
        });

        res.json({ message: 'Moderator added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a post
// @route   DELETE /api/resources/post/:id
// @access  Private
const deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('thread');
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const thread = post.thread;
        const isPostAuthor = post.author.toString() === req.user._id.toString();
        const isThreadOwner = thread.author.toString() === req.user._id.toString();
        const isThreadMod = thread.moderators.some(mod => mod.toString() === req.user._id.toString());

        if (!isPostAuthor && !isThreadOwner && !isThreadMod) {
            return res.status(403).json({ message: 'Not authorized to delete this post' });
        }

        await Post.deleteOne({ _id: req.params.id });
        res.json({ message: 'Post removed from stream' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Toggle GUIDE vote
// @route   PUT /api/resources/thread/:id/guide
// @access  Private
const toggleGuideVote = async (req, res) => {
    try {
        const thread = await Thread.findById(req.params.id);
        if (!thread) return res.status(404).json({ message: 'Thread not found' });

        const userId = req.user._id.toString();

        // Prevent owner/moderator from voting
        if (thread.author.toString() === userId || thread.moderators.some(mod => mod.toString() === userId)) {
            return res.status(403).json({ message: 'Owners and moderators cannot vote for GUIDE status' });
        }

        const alreadyVoted = thread.guideVotes.includes(userId);

        if (alreadyVoted) {
            thread.guideVotes = thread.guideVotes.filter(id => id.toString() !== userId);
        } else {
            thread.guideVotes.push(userId);
        }

        // Auto-promote to Guide if threshold reached (3 votes)
        if (thread.guideVotes.length >= 3) {
            thread.isCurated = true;
        }

        await thread.save();
        res.json({ guideVotes: thread.guideVotes.length, isCurated: thread.isCurated });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Request review for a post
// @route   POST /api/resources/post/:id/review
// @access  Private (Mod/Owner only)
const requestReview = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('thread');
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const thread = post.thread;
        const isOwner = thread.author.toString() === req.user._id.toString();
        const isMod = thread.moderators.some(mod => mod.toString() === req.user._id.toString());

        if (!isOwner && !isMod) {
            return res.status(403).json({ message: 'Only moderators/owners can request reviews' });
        }

        const ReviewRequest = require('../models/ReviewRequest');
        const Request = require('../models/Request');
        const User = require('../models/User');

        const request = await ReviewRequest.create({
            thread: thread._id,
            post: post._id,
            requester: req.user._id,
            notes: req.body.notes || ''
        });

        // Trigger Inbox Alerts
        const { alertTargets, specificUsername } = req.body;
        const targets = new Set();

        if (alertTargets?.includes('owner')) {
            targets.add(thread.author.toString());
        }

        if (alertTargets?.includes('moderators')) {
            thread.moderators.forEach(mod => targets.add(mod.toString()));
        }

        if (alertTargets?.includes('specific') && specificUsername) {
            const specificUser = await User.findOne({ username: specificUsername });
            if (specificUser) {
                targets.add(specificUser._id.toString());
            }
        }

        // Remove requester from targets if they are there
        targets.delete(req.user._id.toString());

        const alertMessage = `[MISSION ALERT] Post flagged in "${thread.title}". Notes: ${req.body.notes || 'No notes provided.'}|||THREAD:${thread._id}`;

        for (const targetId of targets) {
            await Request.create({
                sender: req.user._id,
                receiver: targetId,
                type: 'review_alert',
                message: alertMessage,
                status: 'pending'
            });
        }

        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Acknowledge thread instructions
// @route   POST /api/resources/threads/:id/acknowledge
// @access  Private
const acknowledgeInstructions = async (req, res) => {
    try {
        const thread = await Thread.findById(req.params.id);

        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // Check if user is owner or moderator - they should never need to acknowledge
        const isMod = thread.author.toString() === req.user._id.toString() || thread.moderators.some(mod => mod.toString() === req.user._id.toString());
        if (isMod) {
            return res.json({ message: 'Moderator exemption - no acknowledgment needed', thread });
        }

        // Add user to acknowledged list if not already there
        if (!thread.acknowledgedUsers.some(id => id.toString() === req.user._id.toString())) {
            thread.acknowledgedUsers.push(req.user._id);
            await thread.save();
        }

        res.json({ message: 'Instructions acknowledged', thread });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const updateInstructions = async (req, res) => {
    try {
        const Thread = require('../models/Thread');
        const thread = await Thread.findById(req.params.id);
        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        const isMod = thread.author.toString() === req.user._id.toString() || thread.moderators.some(mod => mod.toString() === req.user._id.toString());
        if (!isMod) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        thread.instructions = req.body.instructions;

        // Reset acknowledged users when instructions change - users must re-acknowledge
        thread.acknowledgedUsers = [];

        await thread.save();
        res.json({ message: 'Instructions updated', thread });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
// @desc    Remove moderator from thread
// @route   DELETE /api/resources/thread/:id/moderator/:userId
// @access  Private
const removeModerator = async (req, res) => {
    try {
        const Thread = require('../models/Thread');
        const thread = await Thread.findById(req.params.id);

        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // Only owner can remove mods
        if (thread.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the author can remove moderators' });
        }

        const userIdToRemove = req.params.userId;

        if (!thread.moderators.includes(userIdToRemove)) {
            return res.status(400).json({ message: 'User is not a moderator of this thread' });
        }

        thread.moderators = thread.moderators.filter(modId => modId.toString() !== userIdToRemove);
        await thread.save();

        res.json({ message: 'Moderator removed successfully', moderators: thread.moderators });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Purchase a paid thread (V2.0)
// @route   POST /api/resources/thread/:id/purchase
// @access  Private
const purchaseThread = async (req, res) => {
    try {
        const User = require('../models/User');
        const threadId = req.params.id;
        const userId = req.user._id.toString();

        // Find thread
        const thread = await Thread.findById(threadId);
        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // Check if thread is actually paid
        if (!thread.isPaid) {
            return res.status(400).json({ message: 'This thread is free' });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user already purchased
        if (user.purchasedThreads.includes(threadId)) {
            return res.status(400).json({ message: 'You already own this thread' });
        }

        // Check if user has enough stars
        if (user.stars < thread.price) {
            return res.status(400).json({
                message: 'Insufficient stars',
                required: thread.price,
                current: user.stars
            });
        }

        // Deduct stars and grant access
        user.stars -= thread.price;
        user.purchasedThreads.push(threadId);
        await user.save();

        res.json({
            message: 'Thread purchased successfully',
            stars: user.stars,
            thread: {
                _id: thread._id,
                title: thread.title
            }
        });
    } catch (error) {
        console.error('Purchase thread error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all unique tags used across threads
// @route   GET /api/resources/tags
// @access  Public
const getUniqueTags = async (req, res) => {
    try {
        const uniqueTags = await Thread.distinct('tags');
        res.json(uniqueTags);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Toggle pin on a thread
// @route   PUT /api/resources/thread/:id/pin
// @access  Private
const togglePinThread = async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user._id);
        const threadId = req.params.id;

        const isPinned = user.pinnedThreads.includes(threadId);

        if (isPinned) {
            user.pinnedThreads = user.pinnedThreads.filter(id => id.toString() !== threadId);
        } else {
            user.pinnedThreads.push(threadId);
        }

        await user.save();
        res.json({ isPinned: !isPinned, pinnedThreads: user.pinnedThreads });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get user activity (Moderate, Paid, Pinned)
// @route   GET /api/resources/activity
// @access  Private
const getUserActivity = async (req, res) => {
    try {
        const { type } = req.query;
        const userId = req.user._id;
        let query = {};

        if (type === 'moderate') {
            // Threads where user is a moderator but NOT the author
            query = {
                moderators: userId,
                author: { $ne: userId }
            };
        } else if (type === 'paid') {
            const User = require('../models/User');
            const user = await User.findById(userId);
            query = { _id: { $in: user.purchasedThreads || [] } };
        } else if (type === 'pinned') {
            const User = require('../models/User');
            const user = await User.findById(userId);
            query = { _id: { $in: user.pinnedThreads || [] } };
        } else {
            return res.status(400).json({ message: 'Invalid activity type' });
        }

        // Fetch threads with basic info and post counts
        const threads = await Thread.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'posts',
                    localField: '_id',
                    foreignField: 'thread',
                    as: 'posts'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            { $unwind: '$author' },
            {
                $project: {
                    title: 1,
                    description: 1,
                    tags: 1,
                    isCurated: 1,
                    isPaid: 1,
                    price: 1,
                    createdAt: 1,
                    'author.name': 1,
                    'author.username': 1,
                    postCount: { $size: '$posts' },
                    upvoteCount: { $sum: '$posts.upvoteCount' }
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        res.json(threads);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    createThread,
    getThreads,
    getUniqueTags,
    getThreadDetail,
    updateThread,
    updateThreadPrice,
    deleteThread,
    addModerator,
    removeModerator,
    acknowledgeInstructions,
    toggleGuideVote,
    addPost,
    deletePost,
    toggleUpvote,
    requestReview,
    updateInstructions,
    purchaseThread,
    togglePinThread,
    getUserActivity,
};
