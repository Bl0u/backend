const Thread = require('../models/Thread');
const Post = require('../models/Post');

// @desc    Create a new thread
// @route   POST /api/resources/thread
// @access  Private
const createThread = async (req, res) => {
    try {
        const { title, description, content, tags, type, isCurated } = req.body;

        let attachments = [];
        if (req.file) {
            attachments.push(`/uploads/${req.file.filename}`);
        }

        const thread = await Thread.create({
            author: req.user.id,
            title,
            description,
            content,
            tags: typeof tags === 'string' ? JSON.parse(tags) : tags, // Handle FormData stringification
            type,
            isCurated: isCurated === 'true' || isCurated === true,
            attachments
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
        const { search, tag, curated } = req.query;
        let query = {};

        if (curated === 'true') {
            query.isCurated = true;
        } else if (curated === 'false') {
            query.isCurated = false;
        }

        if (tag) {
            query.tags = tag.startsWith('#') ? tag : `#${tag}`;
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

        const posts = await Post.find({ thread: req.params.id })
            .populate('author', 'name username avatar')
            .sort({ upvoteCount: -1, createdAt: 1 });

        res.json({ thread, posts });
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
            author: req.user.id,
            contentType,
            content,
            attachments,
            parentPost: req.body.parentPost || null
        });

        // Send notification to thread owner for top-level posts and replies
        if (thread.author.toString() !== req.user.id) {
            const Request = require('../models/Request');
            const User = require('../models/User');
            const postAuthor = await User.findById(req.user.id);
            const isReply = !!req.body.parentPost;

            await Request.create({
                sender: req.user.id,
                receiver: thread.author,
                type: 'notification',
                message: `${postAuthor.name} ${isReply ? 'replied to a post' : 'added a new post'} in your thread "${thread.title}"|||THREAD:${threadId}`,
                status: 'accepted',
                isPublic: false
            });
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

        const userId = req.user.id;
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
        const { title, tags } = req.body;
        const thread = await Thread.findById(req.params.id);

        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // Check if owner or moderator
        const isOwner = thread.author.toString() === req.user.id;
        const isMod = thread.moderators.includes(req.user.id);

        if (!isOwner && !isMod) {
            return res.status(403).json({ message: 'Not authorized to edit this thread' });
        }

        if (title) thread.title = title;
        if (tags) thread.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;

        await thread.save();
        res.json(thread);
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
        if (thread.author.toString() !== req.user.id) {
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
        if (thread.author.toString() !== req.user.id) {
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
            sender: req.user.id,
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
        const isPostAuthor = post.author.toString() === req.user.id;
        const isThreadOwner = thread.author.toString() === req.user.id;
        const isThreadMod = thread.moderators.includes(req.user.id);

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

        const userId = req.user.id;

        // Prevent owner/moderator from voting
        if (thread.author.toString() === userId || thread.moderators.includes(userId)) {
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
        const isOwner = thread.author.toString() === req.user.id;
        const isMod = thread.moderators.includes(req.user.id);

        if (!isOwner && !isMod) {
            return res.status(403).json({ message: 'Only moderators/owners can request reviews' });
        }

        const ReviewRequest = require('../models/ReviewRequest');
        const Request = require('../models/Request');
        const User = require('../models/User');

        const request = await ReviewRequest.create({
            thread: thread._id,
            post: post._id,
            requester: req.user.id,
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
        targets.delete(req.user.id);

        const alertMessage = `[MISSION ALERT] Post flagged in "${thread.title}". Notes: ${req.body.notes || 'No notes provided.'}|||THREAD:${thread._id}`;

        for (const targetId of targets) {
            await Request.create({
                sender: req.user.id,
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
        const isMod = thread.author.toString() === req.user.id || thread.moderators.includes(req.user.id);
        if (isMod) {
            return res.json({ message: 'Moderator exemption - no acknowledgment needed', thread });
        }

        // Add user to acknowledged list if not already there
        if (!thread.acknowledgedUsers.includes(req.user.id)) {
            thread.acknowledgedUsers.push(req.user.id);
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

        const isMod = thread.author.toString() === req.user.id || thread.moderators.includes(req.user.id);
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
        if (thread.author.toString() !== req.user.id) {
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

module.exports = {
    createThread,
    getThreads,
    getThreadDetail,
    updateThread,
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
};
