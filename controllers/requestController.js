const Request = require('../models/Request');
const User = require('../models/User');
const GroupChat = require('../models/GroupChat');
const Community = require('../models/Community');
const Message = require('../models/Message');
const Plan = require('../models/Plan');

// @desc    Send a request (Mentorship or Partner)
// @route   POST /api/requests
// @access  Private
const sendRequest = async (req, res) => {
    const { receiverId, type, message, pitch, isPublic, teamSize, mentorNeeded, isProBono, roles } = req.body;
    const normalizedIsPublic = !!isPublic;

    const communityId = req.body.community;
    const groupChatId = req.body.groupChat;

    // 0. Ban check
    if (communityId || groupChatId) {
        if (communityId) {
            const community = await Community.findById(communityId);
            if (community && community.bannedUsers?.includes(req.user.id)) {
                return res.status(403).json({ message: 'You are banned from this community' });
            }
        }
        if (groupChatId) {
            const group = await GroupChat.findById(groupChatId);
            if (group && group.bannedUsers?.includes(req.user.id)) {
                return res.status(403).json({ message: 'You are banned from this circle' });
            }
        }
    }

    // 1. Resolve receiver for community_join requests if not provided
    let finalReceiverId = receiverId;
    if (type === 'community_join') {
        try {
            let target = null;
            if (req.body.groupChat) {
                target = await GroupChat.findById(req.body.groupChat);
                if (target && target.privacyType === 'public') {
                    // INSTANT JOIN GROUP
                    if (!target.members.includes(req.user.id)) {
                        target.members.push(req.user.id);
                        await target.save();
                    }
                    await Message.create({
                        groupChat: target._id,
                        sender: req.user.id,
                        content: `👋 ${req.user.name} has joined the unit.`,
                        isAnnouncement: true
                    });
                    return res.status(200).json({ status: 'joined', message: 'Joined group instantly' });
                }
                finalReceiverId = target?.creator || target?.moderators?.[0];
            } else if (req.body.community) {
                target = await Community.findById(req.body.community);
                if (target && target.privacyType === 'public') {
                    // INSTANT JOIN COMMUNITY
                    if (!target.members.includes(req.user.id)) {
                        target.members.push(req.user.id);
                        await target.save();
                    }
                    return res.status(200).json({ status: 'joined', message: 'Joined community instantly' });
                }
                finalReceiverId = target?.creator || target?.moderators?.[0];
            }
        } catch (error) {
            console.error('Error resolving community join receiver:', error);
        }
    }

    // 2. Final Fallback to Admin
    if (!normalizedIsPublic && !finalReceiverId) {
        const admin = await User.findOne({ roles: 'admin' });
        finalReceiverId = admin?._id;
    }

    // 3. Global receiver check
    const resolvedReceiverId = finalReceiverId;
    if (!normalizedIsPublic && !resolvedReceiverId) {
        console.error('Validation Error: No receiver resolved for request type:', type);
        return res.status(400).json({ message: 'Receiver is required for this request' });
    }

    // 4. Auth & Duplicate checks
    if (!normalizedIsPublic && req.user.id === resolvedReceiverId.toString()) {
        return res.status(400).json({ message: 'Cannot send request to yourself' });
    }

    if (!normalizedIsPublic) {
        const existingActiveRequest = await Request.findOne({
            $or: [
                { sender: req.user.id, receiver: resolvedReceiverId },
                { sender: resolvedReceiverId, receiver: req.user.id }
            ],
            type,
            status: { $in: ['pending', 'accepted'] }
        });

        if (existingActiveRequest && type !== 'notification' && type !== 'review_alert') {
            return res.status(400).json({ message: 'An active request already exists' });
        }
    }

    // 5. Create Request
    try {
        const request = await Request.create({
            sender: req.user.id,
            receiver: normalizedIsPublic ? undefined : resolvedReceiverId,
            type: type || 'partner',
            message,
            pitch,
            groupChat: req.body.groupChat,
            community: req.body.community,
            answers: req.body.answers,
            pitchRef: req.body.pitchRef,
            isPublic: normalizedIsPublic,
            teamSize: roles ? roles.filter(r => r.roleType === 'teammate' || !r.roleType).length : (teamSize || 1),
            mentorNeeded: !!mentorNeeded,
            isProBono: !!isProBono,
            roles: roles || []
        });

        res.status(201).json(request);
    } catch (error) {
        console.error('Request Creation Error:', error);
        res.status(400).json({ message: error.message || 'Failed to create request' });
    }
};

// @desc    Get received requests
// @route   GET /api/requests/received
// @access  Private
const getReceivedRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.roles.includes('admin');

        // 1. Direct requests where user is the receiver
        const directQuery = { receiver: userId };

        // 2. Community join requests where user is a moderator or admin
        // First find groups where user is mod
        const modGroups = await GroupChat.find({ moderators: userId }).select('_id communityId');
        
        // Find communities where user is a moderator
        const Community = require('../models/Community');
        const modCommunities = await Community.find({ moderators: userId }).select('_id');
        const modCommunityIds = modCommunities.map(c => c._id);

        // Find all groups belonging to those communities
        const inheritedGroups = await GroupChat.find({ communityId: { $in: modCommunityIds } }).select('_id');
        
        const allModGroupIds = [...new Set([
            ...modGroups.map(g => g._id),
            ...inheritedGroups.map(g => g._id)
        ])];

        const communityJoinQuery = {
            type: 'community_join',
            $or: [
                { groupChat: { $in: allModGroupIds } },
                { community: { $in: modCommunityIds } }
            ]
        };

        // If admin, they see all community joins? Or maybe just those they moderate?
        // User said: "request is sent to the author of the group (admin in this case) and moderators assigned by the admin"
        // Let's also include those where they are the creator of the group
        const createdGroups = await GroupChat.find({ creator: userId }).select('_id');
        const createdGroupIds = createdGroups.map(g => g._id);

        // Also include communities user created
        const createdCommunities = await Community.find({ creator: userId }).select('_id');
        const createdCommunityIds = createdCommunities.map(c => c._id);

        communityJoinQuery.$or.push({ groupChat: { $in: createdGroupIds } });
        communityJoinQuery.$or.push({ community: { $in: createdCommunityIds } });

        const requests = await Request.find({
            $or: [
                directQuery,
                communityJoinQuery
            ]
        })
            .populate('sender', 'name username role profilePicture')
            .populate('groupChat', 'name avatar communityId')
            .populate('pitchRef')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        console.error('getReceivedRequests error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get sent requests
// @route   GET /api/requests/sent
// @access  Private
const getSentRequests = async (req, res) => {
    try {
        const requests = await Request.find({ sender: req.user.id })
            .populate('receiver', 'name username role profilePicture')
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get public pitches
// @route   GET /api/requests/public
// @access  Public
const getPublicPitches = async (req, res) => {
    try {
        const pitches = await Request.find({
            isPublic: true,
            status: { $in: ['pending', 'accepted'] }
        })
            .populate('sender', 'name username role profilePicture')
            .populate('contributors', 'name username avatar')
            .populate('mentor', 'name username avatar')
            .populate({
                path: 'roles.filledBy',
                select: 'name username avatar'
            })
            .sort({ createdAt: -1 });
        res.json(pitches);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Claim a public pitch (Partner)
// @route   PUT /api/requests/:id/claim
// @access  Private
const claimPublicPitch = async (req, res) => {
    const request = await Request.findById(req.params.id);

    if (!request || !request.isPublic || (request.status !== 'pending' && request.status !== 'accepted')) {
        return res.status(404).json({ message: 'Public pitch not found or already filled' });
    }

    const { role, roleName } = req.body; // 'teammate' or 'mentor', plus specific role name
    const claimingUser = await User.findById(req.user.id);

    if (role === 'mentor' && !claimingUser.roles.includes('mentor')) {
        return res.status(403).json({ message: 'Only accounts with the "mentor" role can apply for mentor missions' });
    }

    // UNIFIED: All joins now require approval
    const existingClaim = await Request.findOne({
        sender: req.user.id,
        pitchRef: request._id,
        type: 'pitch_claim',
        status: 'pending'
    });

    if (existingClaim) {
        return res.status(400).json({ message: 'You already have a pending join request for this mission' });
    }

    const claimRequest = await Request.create({
        sender: req.user.id,
        receiver: request.sender,
        type: 'pitch_claim',
        pitchRef: request._id,
        claimRole: role || 'teammate',
        roleName: roleName || role || 'teammate',
        status: 'pending',
        message: `Wants to join as ${roleName || role || 'teammate'}`
    });

    return res.json({
        message: 'Join request sent to project owner for approval',
        request: claimRequest,
        isPendingApproval: true
    });
};

// Internal Helper: Handles the actual logic of adding a user to a pitch
// Reused by claimPublicPitch (Standard) and approvePitchClaim (Pro-Bono)
const handlePitchEnrollment = async (request, user, role, roleName, res) => {
    // Update Project Status & Contributors
    if (role === 'mentor') {
        if (!request.mentorNeeded) {
            return res.status(400).json({ message: 'A mentor is not requested for this mission' });
        }
        if (request.mentor) {
            return res.status(400).json({ message: 'The mentor spot is already filled' });
        }
        request.mentor = user._id;

        // SYNC: Find and fill the mentor role in the roles array if it exists
        if (request.roles && request.roles.length > 0) {
            const specificRole = request.roles.find(r =>
                (r.roleType === 'mentor' || (roleName && r.name === roleName)) && !r.isFilled
            );
            if (specificRole) {
                specificRole.isFilled = true;
                specificRole.filledBy = user._id;
            }
        }
    } else {
        // Default to teammate
        if (request.contributors.includes(user._id)) {
            return res.status(400).json({ message: 'User has already joined this mission' });
        }

        // STAFFING CHECK: Use total teammate roles if defined, otherwise teamSize
        let totalTeammateSlots = 0;
        if (request.roles && request.roles.length > 0) {
            totalTeammateSlots = request.roles.filter(r => r.roleType === 'teammate' || !r.roleType).length;
        } else {
            totalTeammateSlots = request.teamSize || 0;
        }

        if (request.contributors.length >= totalTeammateSlots && totalTeammateSlots > 0) {
            return res.status(400).json({ message: 'All teammate slots for this mission are already taken. Check back for other opportunities!' });
        }

        request.contributors.push(user._id);

        // SYNC: Find and fill the specific role in the roles array
        if (request.roles && request.roles.length > 0) {
            // Priority 1: Match by roleName (exact or case-insensitive)
            // Priority 2: Match by claimRole string if it was passed in 'role' argument
            const targetRoleName = (roleName || role || '').toLowerCase();
            const specificRole = request.roles.find(r => 
                (r.name && r.name.toLowerCase() === targetRoleName) && !r.isFilled
            );
            if (specificRole) {
                specificRole.isFilled = true;
                specificRole.filledBy = user._id;
            } else {
                // Last ditch: just fill any teammate role that matches the roleType if name match fails
                const fallbackRole = request.roles.find(r => 
                    (r.roleType === 'teammate' || !r.roleType) && !r.isFilled
                );
                if (fallbackRole) {
                    fallbackRole.isFilled = true;
                    fallbackRole.filledBy = user._id;
                }
            }
        }
    }

    // Check if mission is fully staffed
    let totalTeammateSlots = 0;
    if (request.roles && request.roles.length > 0) {
        totalTeammateSlots = request.roles.filter(r => r.roleType === 'teammate' || !r.roleType).length;
    } else {
        totalTeammateSlots = request.teamSize || 0;
    }

    const isTeamFull = request.contributors.length >= totalTeammateSlots;
    const isMentorFull = !request.mentorNeeded || !!request.mentor;

    if (isTeamFull && isMentorFull) {
        request.status = 'ongoing'; // ACTIVE MISSION
    } else {
        request.status = 'accepted'; // Partly Filled -> Keep in Hub
    }

    // Always ensure one main receiver is set for legacy compatibility
    if (!request.receiver) {
        request.receiver = user._id;
        request.claimedBy = user._id;
    }

    // Update progress percentage
    const totalSlots = totalTeammateSlots + (request.mentorNeeded ? 1 : 0);
    const filledSlots = (request.contributors?.length || 0) + (request.mentor ? 1 : 0);
    request.progress = Math.min(100, Math.round((filledSlots / totalSlots) * 100));

    await request.save();

    // Mission Plan Consolidation
    const owner = await User.findById(request.sender);
    if (owner) {
        try {
            const Plan = require('../models/Plan');

            // Check if a plan already exists for this specific PROJECT
            let projectPlan = await Plan.findOne({ projectRef: request._id });

            if (!projectPlan) {
                // If no plan exists for the project, check legacy pair-wise plan (Owner + Joiner)
                projectPlan = await Plan.findOne({
                    $or: [
                        { partner1: user._id, partner2: owner._id },
                        { partner1: owner._id, partner2: user._id }
                    ]
                });

                if (!projectPlan) {
                    // Create NEW Unified Project Plan
                    const defaultContent = `# Mission Control: ${request.pitch?.get('Hook') || "Project"}\n\nWelcome to your unified team workspace. Collaborate on your mission goals here.`;
                    projectPlan = new Plan({
                        partner1: owner._id,
                        partner2: user._id, // Keep for legacy, but we'll use projectRef for team
                        projectRef: request._id,
                        versions: [{
                            versionMajor: 0,
                            versionMinor: 0,
                            title: 'Initial Mission Plan',
                            content: owner.planTemplate || user.planTemplate || defaultContent,
                            authorName: owner.name,
                            comments: []
                        }]
                    });
                    await projectPlan.save();
                } else {
                    // Upgrade legacy plan to include projectRef
                    projectPlan.projectRef = request._id;
                    await projectPlan.save();
                }
            }

            const pitchTitle = request.pitch?.get('Hook') || request.pitch?.get('The Hook (Short summary)') || "New Project";

            // If mission just became ongoing, notify the WHOLE team
            if (request.status === 'ongoing') {
                const teamMembers = [...(request.contributors || []), request.mentor, request.sender].filter(Boolean);

                for (const memberId of teamMembers) {
                    await Request.create({
                        sender: owner._id,
                        receiver: memberId,
                        type: 'notification',
                        message: `MISSION START! 🚀 "${pitchTitle}" is fully staffed and ready for action. Visit the unified plan.|||PROJECT_PLAN:${request._id}`,
                        status: 'accepted',
                        isPublic: false
                    });
                }
            } else {
                // Just notify the joiner
                await Request.create({
                    sender: owner._id,
                    receiver: user._id,
                    type: 'notification',
                    message: `MISSION ACCEPTED! 🎉 You have officially joined "${pitchTitle}". Visit the project plan.|||PROJECT_PLAN:${request._id}`,
                    status: 'accepted',
                    isPublic: false
                });
            }
        } catch (error) {
            console.error('Unified Plan creation error:', error);
        }
    }

    return res.json({ message: 'Pitch joined successfully', request });
};

// @desc    Approve a join request for a pro-bono pitch
// @route   PUT /api/requests/:id/approve-claim
// @access  Private
const approvePitchClaim = async (req, res) => {
    const claimRequest = await Request.findById(req.params.id);

    if (!claimRequest || claimRequest.type !== 'pitch_claim' || claimRequest.status !== 'pending') {
        return res.status(404).json({ message: 'Pending claim request not found' });
    }

    // Only the pitch owner (receiver of the claim) can approve
    if (claimRequest.receiver.toString() !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to approve this request' });
    }

    const pitch = await Request.findById(claimRequest.pitchRef);
    if (!pitch) {
        return res.status(404).json({ message: 'Mission pitch no longer exists' });
    }

    const claimingUser = await User.findById(claimRequest.sender);
    if (!claimingUser) {
        return res.status(404).json({ message: 'User no longer exists' });
    }

    // Mark claim as accepted
    claimRequest.status = 'accepted';
    await claimRequest.save();

    // Use common handler to enroll the user
    return handlePitchEnrollment(pitch, claimingUser, claimRequest.claimRole, claimRequest.roleName, res);
};

// @desc    Reject a join request for a pro-bono pitch
// @route   PUT /api/requests/:id/reject-claim
// @access  Private
const rejectPitchClaim = async (req, res) => {
    const claimRequest = await Request.findById(req.params.id);

    if (!claimRequest || claimRequest.type !== 'pitch_claim' || claimRequest.status !== 'pending') {
        return res.status(404).json({ message: 'Pending claim request not found' });
    }

    if (claimRequest.receiver.toString() !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to reject this request' });
    }

    claimRequest.status = 'rejected';
    await claimRequest.save();

    // Notify the sender
    await Request.create({
        sender: req.user.id,
        receiver: claimRequest.sender,
        type: 'notification',
        message: `Your request to join the mission has been declined.`,
        status: 'rejected',
        isPublic: false
    });

    res.json({ message: 'Join request declined' });
};

// @desc    Respond to private request
// @route   PUT /api/requests/:id/respond
// @access  Private
const respondToRequest = async (req, res) => {
    const { status } = req.body;
    const request = await Request.findById(req.params.id);

    if (!request) {
        return res.status(404).json({ message: 'Request not found' });
    }

    // AUTH CHECK: Direct receiver OR moderator (for community joins)
    let isAuthorized = request.receiver.toString() === req.user.id;

    if (!isAuthorized && request.type === 'community_join') {
        // Check if user is a moderator of the group or community
        if (request.groupChat) {
            const group = await GroupChat.findById(request.groupChat);
            if (group) {
                const isGroupMod = group.moderators.includes(req.user.id);
                const Community = require('../models/Community');
                const community = await Community.findById(group.communityId);
                const isCommMod = community?.moderators.includes(req.user.id);
                if (isGroupMod || isCommMod) isAuthorized = true;
            }
        } else if (request.community) {
            const Community = require('../models/Community');
            const community = await Community.findById(request.community);
            if (community?.moderators.includes(req.user.id)) isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    request.status = status;
    await request.save();

    if (status === 'accepted') {
        const sender = await User.findById(request.sender);
        const receiver = await User.findById(req.user.id);
        if (sender && receiver && (request.type === 'partnership' || request.type === 'partner' || request.type === 'mentorship')) {
            const activePartner = receiver.enrolledPartners.find(p => p.user.toString() === sender._id.toString() && p.status === 'active');
            if (!activePartner) {
                receiver.enrolledPartners.push({ user: sender._id, status: 'active' });
                await receiver.save();

                sender.enrolledPartners.push({ user: receiver._id, status: 'active' });
                await sender.save();
            }

            // Create collaboration plan
            try {
                const Plan = require('../models/Plan');
                // Check if plan exists
                const existingPlan = await Plan.findOne({
                    $or: [
                        { partner1: receiver._id, partner2: sender._id },
                        { partner1: sender._id, partner2: receiver._id }
                    ]
                });

                if (!existingPlan) {
                    const defaultContent = `# Collaboration Plan\n\nWelcome! Work together on your project goals here.`;
                    const newPlan = new Plan({
                        partner1: receiver._id,
                        partner2: sender._id,
                        versions: [{
                            versionMajor: 0,
                            versionMinor: 0,
                            title: 'Initial Collaboration Plan',
                            content: receiver.planTemplate || sender.planTemplate || defaultContent,
                            authorName: receiver.name,
                            comments: []
                        }]
                    });
                    await newPlan.save();

                    await Request.create({
                        sender: req.user.id,
                        receiver: sender._id,
                        type: 'notification',
                        message: `Your partnership request has been accepted! 🎉 Collaborative plan created.|||PLAN:${newPlan._id}`,
                        status: 'accepted',
                        isPublic: false
                    });
                } else {
                    await Request.create({
                        sender: req.user.id,
                        receiver: sender._id,
                        type: 'notification',
                        message: `Your partnership request has been accepted! 🎉 Check your shared plan.|||PLAN:${existingPlan._id}`,
                        status: 'accepted',
                        isPublic: false
                    });
                }
            } catch (error) {
                console.error('Plan creation error in acceptance:', error);
            }
        }
    }

    // Community Join Specific Logic
    if (status === 'accepted' && request.type === 'community_join') {
        try {
            if (request.groupChat) {
                const group = await GroupChat.findById(request.groupChat);
                if (group) {
                    if (!group.members.includes(request.sender)) {
                        group.members.push(request.sender);
                        await group.save();
                    }

                    await Request.create({
                        sender: req.user.id,
                        receiver: request.sender,
                        type: 'notification',
                        message: `You have been accepted into the group "${group.name}"! 🚀 Check your chat box.`,
                        status: 'accepted',
                        isPublic: false
                    });
                }
            } else if (request.community) {
                const Community = require('../models/Community');
                const community = await Community.findById(request.community);
                if (community) {
                    if (!community.members.includes(request.sender)) {
                        community.members.push(request.sender);
                        await community.save();
                    }

                    await Request.create({
                        sender: req.user.id,
                        receiver: request.sender,
                        type: 'notification',
                        message: `You have been accepted into the community "${community.name}"! 🚀`,
                        status: 'accepted',
                        isPublic: false
                    });
                }
            }
        } catch (error) {
            console.error('Community join acceptance error:', error);
        }
    } else if (status === 'rejected') {
        const message = request.type === 'community_join'
            ? `Your request to join the group was declined.`
            : `Your partnership request was declined. You may try again later.`;

        await Request.create({
            sender: req.user.id,
            receiver: request.sender,
            type: 'notification',
            message,
            status: 'rejected',
            isPublic: false
        });
    }

    res.json(request);
};

// @desc    Update partnership record note
// @route   PUT /api/requests/history/note
// @access  Private
const updateRelationshipNote = async (req, res) => {
    try {
        const { historyId, notes } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const historyItem = user.partnerHistory.id(historyId);
        if (!historyItem) {
            return res.status(404).json({ message: 'Record not found' });
        }

        historyItem.notes = notes;
        await user.save();

        res.json({ message: 'Note updated successfully', historyItem });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Mark notification as read
// @route   DELETE /api/requests/:id/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        await Request.findByIdAndDelete(req.params.id);
        res.json({ message: 'Notification cleared' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    End an active partnership
// @route   PUT /api/requests/relationship/end
// @access  Private
const endRelationship = async (req, res) => {
    const { targetUserId } = req.body;
    const currentUser = await User.findById(req.user.id);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) {
        return res.status(404).json({ message: 'User not found' });
    }

    let relationshipFound = false;

    // Handle partnership ending
    const partnerA = currentUser.enrolledPartners.find(p => p.user.toString() === targetUserId && p.status === 'active');
    if (partnerA) {
        partnerA.status = 'completed';
        partnerA.endDate = new Date();
        relationshipFound = true;

        // Add to history
        currentUser.partnerHistory.push({
            partnerName: targetUser.name,
            partnerUsername: targetUser.username,
            startDate: partnerA.startDate,
            endDate: new Date()
        });
    }

    const partnerB = targetUser.enrolledPartners.find(p => p.user.toString() === req.user.id && p.status === 'active');
    if (partnerB) {
        partnerB.status = 'completed';
        partnerB.endDate = new Date();

        // Add to history
        targetUser.partnerHistory.push({
            partnerName: currentUser.name,
            partnerUsername: currentUser.username,
            startDate: partnerB.startDate,
            endDate: new Date()
        });
    }

    if (!relationshipFound) {
        return res.status(400).json({ message: `No active partnership found with this user` });
    }

    // Mark ALL relevant requests as 'completed'
    await Request.updateMany(
        {
            $or: [
                { sender: req.user.id, receiver: targetUserId, status: { $in: ['accepted', 'pending'] } },
                { sender: targetUserId, receiver: req.user.id, status: { $in: ['accepted', 'pending'] } }
            ],
            type: 'partner'
        },
        { status: 'completed' }
    );

    await currentUser.save();
    await targetUser.save();

    // Send notification to the other user
    await Request.create({
        sender: req.user.id,
        receiver: targetUserId,
        type: 'notification',
        message: `Your partnership with ${currentUser.name} has ended. Thank you for your collaboration! 🤝`,
        status: 'completed',
        isPublic: false
    });

    res.json({ message: `Partnership successfully completed`, currentUser });
};


// @desc    Delete/Cancel a request
// @route   DELETE /api/requests/:id
// @access  Private
const cancelRequest = async (req, res) => {
    const request = await Request.findById(req.params.id);

    if (!request) {
        return res.status(404).json({ message: 'Request not found' });
    }

    // Only the sender can cancel a pending request
    if (request.sender.toString() !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to cancel this request' });
    }

    if (request.status !== 'pending') {
        return res.status(400).json({ message: 'Only pending requests can be cancelled. Active partnerships must be ended via the dashboard.' });
    }

    await Request.findByIdAndDelete(req.params.id);
    res.json({ message: 'Request cancelled successfully' });
};

// @desc    Update project title
// @route   PUT /api/requests/:id/title
// @access  Private
const updateProjectTitle = async (req, res) => {
    try {
        const { title } = req.body;
        const project = await Request.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Only the project owner (sender) can update the title
        if (project.sender.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Only the project lead can change the title' });
        }

        if (!project.pitch) {
            project.pitch = new Map();
        }

        // Handle both Hook styles
        if (project.pitch.has('Hook')) {
            project.pitch.set('Hook', title);
        } else if (project.pitch.has('The Hook (Short summary)')) {
            project.pitch.set('The Hook (Short summary)', title);
        } else {
            // Default to Hook if neither exists
            project.pitch.set('Hook', title);
        }

        await project.save();
        res.json({ message: 'Project title updated successfully', project });
    } catch (error) {
        console.error('Error updating project title:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Check if users are connected (for reviews)
// @route   GET /api/requests/check/:userId
// @access  Private
const checkConnection = async (req, res) => {
    try {
        const connection = await Request.findOne({
            $or: [
                { sender: req.user.id, receiver: req.params.userId, status: 'accepted' },
                { sender: req.params.userId, receiver: req.user.id, status: 'accepted' }
            ]
        });
        res.json({ isConnected: !!connection });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get user's active/completed projects (from pitches)
// @route   GET /api/requests/my-projects
// @access  Private
const getMyProjects = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const projects = await Request.find({
            isPublic: true,
            $or: [
                { sender: req.user.id },
                { contributors: req.user.id },
                { mentor: req.user.id }
            ]
        })
            .populate('sender', 'name username role profilePicture')
            .populate('contributors', 'name username avatar')
            .populate('mentor', 'name username avatar')
            .sort({ updatedAt: -1 });

        res.json(projects || []);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Mark project as completed
// @route   PUT /api/requests/:id/complete
// @access  Private
const completeProject = async (req, res) => {
    try {
        const project = await Request.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Only the project owner (sender) can complete it
        if (project.sender.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Only the project lead can complete this mission' });
        }

        project.status = 'completed';
        await project.save();

        // Notify all members
        const members = [...(project.contributors || []), project.mentor].filter(Boolean);

        const pitchTitle = project.pitch?.get('Hook') || project.pitch?.get('The Hook (Short summary)') || "Mission";

        for (const memberId of members) {
            await Request.create({
                sender: req.user.id,
                receiver: memberId,
                type: 'notification',
                message: `Mission Accomplished! 🏁 The project "${pitchTitle}" has been marked as completed. Well done!`,
                status: 'accepted',
                isPublic: false
            });
        }

        res.json({ message: 'Project completed successfully', project });
    } catch (error) {
        console.error('Error completing project:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    sendRequest,
    getReceivedRequests,
    getSentRequests,
    getPublicPitches,
    claimPublicPitch,
    approvePitchClaim,
    rejectPitchClaim,
    respondToRequest,
    markAsRead,
    checkConnection,
    endRelationship,
    cancelRequest,
    updateRelationshipNote,
    getMyProjects,
    completeProject,
    updateProjectTitle
};
