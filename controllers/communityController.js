const Community = require('../models/Community');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');
const Message = require('../models/Message');

// @desc    Get communities/groups moderated/owned by the current user
// @route   GET /api/communities/moderated
// @access  Private
const getModeratedContent = async (req, res) => {
    try {
        const userId = req.user._id;
        const isAdmin = req.user.roles.includes('admin');

        let moderatedCommunities;
        let moderatedGroups;

        if (isAdmin) {
            moderatedCommunities = await Community.find().populate('moderators', 'name username');
            moderatedGroups = await GroupChat.find().populate('moderators', 'name username');
        } else {
            moderatedCommunities = await Community.find({
                $or: [
                    { creator: userId },
                    { moderators: userId }
                ]
            }).populate('moderators', 'name username');

            moderatedGroups = await GroupChat.find({
                $or: [
                    { creator: userId },
                    { moderators: userId }
                ]
            }).populate('moderators', 'name username');
        }

        res.json({
            communities: moderatedCommunities,
            groups: moderatedGroups
        });
    } catch (error) {
        console.error('getModeratedContent error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get communities/groups user is a member of
// @route   GET /api/communities/joined
// @access  Private
const getJoinedContent = async (req, res) => {
    try {
        const userId = req.user._id;

        const communities = await Community.find({ members: userId }).select('name avatar description members moderators');
        const groups = await GroupChat.find({ members: userId }).select('name avatar description members moderators communityId privacyType');

        res.json({ communities, groups });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get members of a community or group
// @route   GET /api/communities/:id/members or /api/communities/groups/:id/members
// @access  Private (Moderator/Admin)
const getMembers = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query; // 'community' or 'group'

        let target;
        if (type === 'group') {
            target = await GroupChat.findById(id).populate('members', 'name username avatar');
        } else {
            target = await Community.findById(id).populate('members', 'name username avatar');
        }

        if (!target) return res.status(404).json({ message: 'Not found' });

        // Permission check
        const isMod = target.moderators?.includes(req.user._id) || 
                      target.creator?.toString() === req.user._id.toString() || 
                      req.user.roles.includes('admin');
        
        if (!isMod) return res.status(403).json({ message: 'Not authorized' });

        res.json(target.members);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Ban or unban a user from a community or group
// @route   PUT /api/communities/:id/ban or /api/communities/groups/:id/ban
// @access  Private (Moderator/Admin)
const toggleBan = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, type } = req.body; // type: 'community' or 'group'

        let target;
        if (type === 'group') {
            target = await GroupChat.findById(id);
        } else {
            target = await Community.findById(id);
        }

        if (!target) return res.status(404).json({ message: 'Not found' });

        // Permission check
        const isMod = target.moderators?.includes(req.user._id) || 
                      target.creator?.toString() === req.user._id.toString() || 
                      req.user.roles.includes('admin');
        
        if (!isMod) return res.status(403).json({ message: 'Not authorized' });

        // Cannot ban an admin or a higher moderator? 
        const userToBan = await User.findById(userId);
        if (userToBan.roles.includes('admin')) {
            return res.status(400).json({ message: 'Cannot ban an admin' });
        }

        const banIndex = target.bannedUsers.indexOf(userId);
        if (banIndex > -1) {
            target.bannedUsers.splice(banIndex, 1);
        } else {
            target.bannedUsers.push(userId);
            // Also remove from members
            target.members = target.members.filter(m => m.toString() !== userId);
        }

        await target.save();
        res.json({ message: banIndex > -1 ? 'User unbanned' : 'User banned', bannedUsers: target.bannedUsers });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a circle within a community (Decentralized)
// @route   POST /api/communities/:id/groups
// @access  Private (Admin/Community Mod)
const createCircle = async (req, res) => {
    try {
        const { name, description, avatar, groupType, metadata, moderators, privacyType } = req.body;
        const community = await Community.findById(req.params.id);

        if (!community) return res.status(404).json({ message: 'Community not found' });

        // Permission check: Admin or Community Moderator
        const canCreate = req.user.roles.includes('admin') || 
                          community.moderators.includes(req.user._id) ||
                          community.creator?.toString() === req.user._id.toString();

        if (!canCreate) return res.status(403).json({ message: 'Not authorized to create groups in this community' });

        const group = await GroupChat.create({
            name,
            description,
            avatar,
            groupType: groupType || 'custom',
            metadata,
            moderators: moderators || [],
            communityId: community._id,
            isOfficial: true,
            privacyType: privacyType || 'public',
            creator: req.user._id,
            members: [req.user._id, ...(moderators || [])]
        });

        community.groups.push(group._id);
        await community.save();

        res.status(201).json(group);
    } catch (error) {
        console.error('createCircle error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a group (Decentralized)
// @route   DELETE /api/communities/groups/:groupId
// @access  Private (Admin/Community Mod)
const deleteCircle = async (req, res) => {
    try {
        const { groupId } = req.params;
        const group = await GroupChat.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        const community = await Community.findById(group.communityId);
        
        // Permission check: Admin or Community Moderator
        const canDelete = req.user.roles.includes('admin') || 
                          (community && (community.moderators.includes(req.user._id) || community.creator?.toString() === req.user._id.toString()));

        if (!canDelete) return res.status(403).json({ message: 'Not authorized to delete this group' });

        // Remove group ref from community
        if (community) {
            community.groups = community.groups.filter(g => g.toString() !== groupId);
            await community.save();
        }

        // Delete the group's messages and the group itself
        await Message.deleteMany({ groupChat: groupId });
        await GroupChat.findByIdAndDelete(groupId);

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('deleteCircle error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getModeratedContent,
    getJoinedContent,
    getMembers,
    toggleBan,
    createCircle,
    deleteCircle
};
