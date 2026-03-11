const Message = require('../models/Message');
const User = require('../models/User');
const GroupChat = require('../models/GroupChat');

// @desc    Get recent chats (both 1-1 and groups)
// @route   GET /api/chat/recent
// @access  Private
const getRecentChats = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1️⃣ Find all 1-1 messages where user is sender or receiver
        const messages = await Message.find({
            groupChat: { $exists: false },
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
        const recentIndividualChats = chatUsers.map(user => {
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
                unread: lastMsg.receiver.toString() === userId && !lastMsg.isRead,
                chatType: 'individual'
            };
        });

        // 2️⃣ Find all groups user is a member of
        const groups = await GroupChat.find({
            members: userId
        });

        const recentGroupChats = await Promise.all(groups.map(async (group) => {
            const lastMsg = await Message.findOne({ groupChat: group._id })
                .sort({ createdAt: -1 })
                .populate('sender', 'name');

            return {
                _id: group._id,
                name: group.name,
                avatar: group.avatar,
                lastMessage: lastMsg ? `${lastMsg.sender.name}: ${lastMsg.content}` : 'No messages yet',
                lastMessageTime: lastMsg ? lastMsg.createdAt : group.createdAt,
                unread: false, // Simple implementation for MVP
                chatType: 'group'
            };
        }));

        const recentChats = [...recentIndividualChats, ...recentGroupChats];

        // Sort by last message time
        recentChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

        res.json(recentChats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get messages for a conversation (1-1 or group)
// @route   GET /api/chat/:targetId
// @access  Private
const getMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const { targetId } = req.params;
        const isGroup = req.query.type === 'group';

        let query;
        if (isGroup) {
            query = { groupChat: targetId };
        } else {
            query = {
                groupChat: { $exists: false },
                $or: [
                    { sender: userId, receiver: targetId },
                    { sender: targetId, receiver: userId }
                ]
            };
        }

        const messages = await Message.find(query)
            .populate('sender', 'name username avatar role')
            .sort({ createdAt: 1 });

        // Mark as read for individual chats
        if (!isGroup) {
            await Message.updateMany(
                { sender: targetId, receiver: userId, isRead: false },
                { isRead: true }
            );
        }

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
        const { receiverId, groupId, content, isAnnouncement } = req.body;
        const senderId = req.user.id;

        if (!content) {
            return res.status(400).json({ message: 'Content is required' });
        }

        const messageData = {
            sender: senderId,
            content,
            isAnnouncement: !!isAnnouncement
        };

        if (groupId) {
            messageData.groupChat = groupId;
        } else if (receiverId) {
            messageData.receiver = receiverId;
        } else {
            return res.status(400).json({ message: 'Receiver or Group ID required' });
        }

        const message = await Message.create(messageData);
        const populatedMsg = await Message.findById(message._id)
            .populate('sender', 'name username avatar role');

        res.status(201).json(populatedMsg);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create a group chat
// @route   POST /api/chat/groups
// @access  Private (Lead/Admin)
const createGroupChat = async (req, res) => {
    try {
        const { name, description, userIds, groupType, academicLevel } = req.body;

        // Ensure creator is authorized
        if (!['admin', 'studentLead', 'mentor'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Unauthorized to create groups' });
        }

        const group = await GroupChat.create({
            name,
            description,
            creator: req.user.id,
            members: [...new Set([...userIds, req.user.id])],
            groupType: groupType || 'custom',
            academicLevel,
            isOfficial: req.user.role === 'admin'
        });

        res.status(201).json(group);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Add member to group
// @route   POST /api/chat/groups/:id/members
// @access  Private
const addMemberToGroup = async (req, res) => {
    try {
        const { userId } = req.body;
        const group = await GroupChat.findById(req.params.id);

        if (!group) return res.status(404).json({ message: 'Group not found' });

        // Authorization: Creator or Lead/Admin
        if (group.creator.toString() !== req.user.id && !['admin', 'studentLead'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (group.members.includes(userId)) {
            return res.status(400).json({ message: 'User already in group' });
        }

        group.members.push(userId);
        await group.save();

        res.json(group);
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
    createGroupChat,
    addMemberToGroup,
    getUnreadCount
};
