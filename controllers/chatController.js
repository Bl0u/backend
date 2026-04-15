const Message = require('../models/Message');
const User = require('../models/User');
const GroupChat = require('../models/GroupChat');
const Request = require('../models/Request');

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

        // 2️⃣ Find all groups user is a member of OR user has a matching role
        const currentUser = await User.findById(userId);
        const userRoles = currentUser?.roles || ['student'];
        
        const groups = await GroupChat.find({
            $or: [
                { members: userId },
                { targetRoles: { $in: userRoles } }
            ]
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
        const { name, description, userIds, groupType, academicLevel, targetRoles } = req.body;

        // Ensure creator is authorized
        if (!['admin', 'studentLead', 'mentor'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Unauthorized to create groups' });
        }

        const group = await GroupChat.create({
            name,
            description,
            creator: req.user.id,
            members: [...new Set([...(userIds || []), req.user.id])],
            groupType: groupType || 'custom',
            academicLevel,
            targetRoles: targetRoles || [],
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

// @desc    Request to join an official group
// @route   POST /api/chat/groups/:id/join
// @access  Private
const requestJoinGroup = async (req, res) => {
    try {
        const { answers } = req.body;
        const group = await GroupChat.findById(req.params.id);

        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!group.isOfficial) return res.status(400).json({ message: 'Not an official group' });

        // Check if already a member
        if (group.members.includes(req.user.id)) {
            return res.status(400).json({ message: 'Already a member' });
        }

        // Check for existing pending request
        const existingRequest = await Request.findOne({
            sender: req.user.id,
            groupChat: group._id,
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'Join request already pending' });
        }

        // PUBLIC JOIN: Instant
        if (group.privacyType === 'public') {
            if (!group.members.includes(req.user.id)) {
                group.members.push(req.user.id);
                await group.save();
            }

            // In-chat notification (System message)
            await Message.create({
                groupChat: group._id,
                sender: req.user.id, // Or a system bot user if implemented
                content: `👋 ${req.user.name} has joined the unit.`,
                isAnnouncement: true // Use announcement style for visibility
            });

            return res.status(200).json({ 
                message: 'Joined group successfully', 
                status: 'joined',
                groupId: group._id 
            });
        }

        // PRIVATE JOIN: Create request
        const request = await Request.create({
            sender: req.user.id,
            type: 'community_join',
            groupChat: group._id,
            answers,
            status: 'pending'
        });

        res.status(201).json({ message: 'Join request sent', request, status: 'pending' });
    } catch (error) {
        console.error('requestJoinGroup error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Accept/Reject join request
// @route   PUT /api/chat/requests/:id
// @access  Private (Admin/Moderator)
const handleJoinRequest = async (req, res) => {
    try {
        const { status } = req.body; // 'accepted' or 'rejected'
        const request = await Request.findById(req.params.id).populate('groupChat');

        if (!request) return res.status(404).json({ message: 'Request not found' });

        const group = await GroupChat.findById(request.groupChat._id);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        // Authorization: Admin or Group Moderator
        const isMod = group.moderators.includes(req.user.id);
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin && !isMod) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        request.status = status;
        await request.save();

        if (status === 'accepted') {
            if (!group.members.includes(request.sender)) {
                group.members.push(request.sender);
                await group.save();
            }
        }

        res.json({ message: `Request ${status}`, request });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get or Create a chat for a project
// @route   POST /api/chat/project-chat
// @access  Private
const getOrCreateProjectChat = async (req, res) => {
    try {
        const { projectId } = req.body;
        const userId = req.user.id;

        // 1. Check if chat already exists
        let chat = await GroupChat.findOne({ projectRef: projectId });

        if (chat) {
            // Ensure user is a member or has right to enter
            if (!chat.members.includes(userId)) {
                chat.members.push(userId);
                await chat.save();
            }
            return res.json({ groupId: chat._id });
        }

        // 2. Create new chat based on project
        const project = await Request.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Verify user belongs to project
        const members = [project.sender, ...(project.contributors || []), project.mentor].filter(Boolean).map(id => id.toString());
        if (!members.includes(userId)) {
            return res.status(403).json({ message: 'You are not a member of this project' });
        }

        const pitchTitle = project.pitch?.get('Hook') || project.pitch?.get('The Hook (Short summary)') || "Mission Chat";

        chat = await GroupChat.create({
            name: pitchTitle,
            projectRef: projectId,
            members: [...new Set(members)],
            creator: project.sender,
            groupType: 'custom',
            privacyType: 'private'
        });

        // Add an initial announcement
        await Message.create({
            groupChat: chat._id,
            sender: project.sender,
            content: `🚀 Team chat for "${pitchTitle}" has been established.`,
            isAnnouncement: true
        });

        res.status(201).json({ groupId: chat._id });
    } catch (error) {
        console.error('getOrCreateProjectChat error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Internal helper — add user to all groups whose targetRoles match their roles
// Called after role promotion in adminController.promoteUser
const syncUserRoleGroups = async (userId) => {
    try {
        const user = await User.findById(userId).select('roles name username');
        if (!user || !user.roles || user.roles.length === 0) return;

        // Find groups that target any of this user's roles
        const matchingGroups = await GroupChat.find({
            targetRoles: { $in: user.roles },
            members: { $ne: userId } // Only groups they're not already in
        });

        for (const group of matchingGroups) {
            group.members.push(userId);
            await group.save();

            // Post a system announcement
            await Message.create({
                groupChat: group._id,
                sender: userId,
                content: `👋 ${user.name} has been automatically added based on their role.`,
                isAnnouncement: true
            });
        }

        return matchingGroups.length;
    } catch (error) {
        console.error('syncUserRoleGroups error:', error);
        return 0;
    }
};

// @desc    HTTP handler — sync current user into role-based groups
// @route   POST /api/chat/groups/sync-roles
// @access  Private
const syncRoleGroups = async (req, res) => {
    try {
        const count = await syncUserRoleGroups(req.user._id);
        res.json({ message: `Synced into ${count} group(s) based on your roles`, count });
    } catch (error) {
        console.error('syncRoleGroups error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getRecentChats,
    getMessages,
    sendMessage,
    createGroupChat,
    addMemberToGroup,
    getUnreadCount,
    requestJoinGroup,
    handleJoinRequest,
    getOrCreateProjectChat,
    syncUserRoleGroups,
    syncRoleGroups
};
