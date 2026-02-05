const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Get recent chats (users I've talked to)
// @route   GET /api/chat/recent
// @access  Private
const getRecentChats = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find all messages where user is sender or receiver
        const messages = await Message.find({
            $or: [{ sender: userId }, { receiver: userId }]
        }).sort({ createdAt: -1 });

        // Extract unique user IDs from messages
        const chatUserIds = new Set();
        messages.forEach(msg => {
            if (msg.sender.toString() !== userId) chatUserIds.add(msg.sender.toString());
            if (msg.receiver.toString() !== userId) chatUserIds.add(msg.receiver.toString());
        });

        // Fetch user basic info for these IDs
        const chatUsers = await User.find({
            _id: { $in: Array.from(chatUserIds) }
        }).select('name username avatar');

        // Map users with their last message
        const recentChats = chatUsers.map(user => {
            const lastMsg = messages.find(m =>
                (m.sender.toString() === user._id.toString() && m.receiver.toString() === userId) ||
                (m.receiver.toString() === user._id.toString() && m.sender.toString() === userId)
            );
            return {
                _id: user._id,
                name: user.name,
                username: user.username,
                avatar: user.avatar,
                lastMessage: lastMsg.content,
                lastMessageTime: lastMsg.createdAt,
                unread: lastMsg.receiver.toString() === userId && !lastMsg.isRead
            };
        });

        // Sort by last message time
        recentChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

        res.json(recentChats);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get messages between two users
// @route   GET /api/chat/:targetUserId
// @access  Private
const getMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const { targetUserId } = req.params;

        const messages = await Message.find({
            $or: [
                { sender: userId, receiver: targetUserId },
                { sender: targetUserId, receiver: userId }
            ]
        }).sort({ createdAt: 1 });

        // Mark as read
        await Message.updateMany(
            { sender: targetUserId, receiver: userId, isRead: false },
            { isRead: true }
        );

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Send a message
// @route   POST /api/chat
// @access  Private
const sendMessage = async (req, res) => {
    try {
        const { receiverId, content } = req.body;
        const senderId = req.user.id;

        if (!receiverId || !content) {
            return res.status(400).json({ message: 'Receiver and content required' });
        }

        const message = await Message.create({
            sender: senderId,
            receiver: receiverId,
            content
        });

        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get unread messages count
// @route   GET /api/chat/unread
// @access  Private
const getUnreadCount = async (req, res) => {
    try {
        const count = await Message.countDocuments({
            receiver: req.user.id,
            isRead: false
        });
        res.json({ unreadCount: count });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getRecentChats,
    getMessages,
    sendMessage,
    getUnreadCount
};
