const Request = require('../models/Request');
const User = require('../models/User');

// @desc    Send a request (Mentorship or Partner)
// @route   POST /api/requests
// @access  Private
const sendRequest = async (req, res) => {
    const { receiverId, type, message, pitch, isPublic, teamSize, mentorNeeded, isProBono } = req.body;

    if (!isPublic && req.user.id === receiverId) {
        return res.status(400).json({ message: 'Cannot send request to yourself' });
    }

    // prevent duplicate ACTIVE private requests (allow re-requesting after completion)
    if (!isPublic && receiverId) {
        const existingActiveRequest = await Request.findOne({
            $or: [
                { sender: req.user.id, receiver: receiverId },
                { sender: receiverId, receiver: req.user.id }
            ],
            type,
            status: { $in: ['pending', 'accepted'] }
        });

        if (existingActiveRequest) {
            return res.status(400).json({ message: 'An active request already exists for this user' });
        }

        // Also check if currently enrolled (active relationship)
        const currentUser = await User.findById(req.user.id);
        const isCurrentlyEnrolled = currentUser.enrolledPartners?.some(
            entry => entry.user.toString() === receiverId && entry.status === 'active'
        );

        if (isCurrentlyEnrolled) {
            return res.status(400).json({ message: `You already have an active partnership with this user` });
        }
    }

    const request = await Request.create({
        sender: req.user.id,
        receiver: isPublic ? undefined : receiverId,
        type: 'partner', // Default to partner
        message,
        pitch,
        isPublic: !!isPublic,
        teamSize: teamSize || 1,
        mentorNeeded: !!mentorNeeded,
        isProBono: !!isProBono
    });

    res.status(201).json(request);
};

// @desc    Get received requests
// @route   GET /api/requests/received
// @access  Private
const getReceivedRequests = async (req, res) => {
    try {
        const requests = await Request.find({ receiver: req.user.id })
            .populate('sender', 'name username role profilePicture')
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
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
            $or: [
                { status: 'pending' },
                { isProBono: true, status: 'accepted' }
            ]
        })
            .populate('sender', 'name username role profilePicture')
            .populate('contributors', 'name username avatar') // Populate contributors for progress view
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

    const { role } = req.body; // 'teammate' or 'mentor'
    const claimingUser = await User.findById(req.user.id);

    // Update Project Status & Contributors
    if (role === 'mentor') {
        if (!request.mentorNeeded) {
            return res.status(400).json({ message: 'A mentor is not requested for this mission' });
        }
        if (request.mentor) {
            return res.status(400).json({ message: 'The mentor spot is already filled' });
        }
        request.mentor = req.user.id;
    } else {
        // Default to teammate
        if (request.contributors.includes(req.user.id)) {
            return res.status(400).json({ message: 'You have already joined this mission' });
        }
        if (request.contributors.length >= (request.teamSize || 1)) {
            return res.status(400).json({ message: 'All teammate slots are already filled' });
        }
        request.contributors.push(req.user.id);
    }

    // Check if mission is fully staffed
    const isTeamFull = request.contributors.length >= (request.teamSize || 1);
    const isMentorFull = !request.mentorNeeded || !!request.mentor;

    if (isTeamFull && isMentorFull) {
        request.status = 'completed'; // Filled -> Remove from Hub
    } else {
        request.status = 'accepted'; // Partly Filled -> Keep in Hub
    }

    // Always ensure one main receiver is set for legacy compatibility
    if (!request.receiver) {
        request.receiver = req.user.id;
        request.claimedBy = req.user.id;
    }

    // Update progress percentage
    const totalSlots = (request.teamSize || 1) + (request.mentorNeeded ? 1 : 0);
    const filledSlots = (request.contributors?.length || 0) + (request.mentor ? 1 : 0);
    request.progress = Math.min(100, Math.round((filledSlots / totalSlots) * 100));

    await request.save();

    // Enroll Partners
    const sender = await User.findById(request.sender);
    if (sender) {
        // Check if already enrolled to prevent double entries
        const alreadyEnrolled = claimingUser.enrolledPartners.some(p => p.user.toString() === sender._id.toString() && p.status === 'active');

        if (!alreadyEnrolled) {
            claimingUser.enrolledPartners.push({ user: sender._id, status: 'active' });
            await claimingUser.save();

            sender.enrolledPartners.push({ user: claimingUser._id, status: 'active' });
            await sender.save();
        }

        // Create collaboration plan (Only on first claim for pro-bono or for every standard claim)
        try {
            const Plan = require('../models/Plan');
            const existingPlan = await Plan.findOne({
                $or: [
                    { partner1: req.user.id, partner2: sender._id },
                    { partner1: sender._id, partner2: req.user.id }
                ]
            });

            if (!existingPlan) {
                const defaultContent = `# Collaboration Plan\n\nWelcome to your shared project roadmap.`;
                const newPlan = new Plan({
                    partner1: req.user.id,
                    partner2: sender._id,
                    versions: [{
                        versionMajor: 0,
                        versionMinor: 0,
                        title: 'Initial Collaboration Plan',
                        content: claimingUser.planTemplate || sender.planTemplate || defaultContent,
                        authorName: claimingUser.name,
                        comments: []
                    }]
                });
                await newPlan.save();

                // Create notification for sender
                await Request.create({
                    sender: req.user.id,
                    receiver: sender._id,
                    type: 'notification',
                    message: `COLLABORATION STARTED: ${claimingUser.name} joined your pitch "${request.pitch?.get('Hook')}".${request.isProBono ? ` Progress: ${request.progress}%` : ''}`,
                    status: 'accepted',
                    isPublic: false
                });
            }
        } catch (error) {
            console.error('Plan creation error in claim:', error);
        }
    }

    res.json({ message: 'Pitch claimed successfully', request });
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

    if (request.receiver.toString() !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    request.status = status;
    await request.save();

    if (status === 'accepted') {
        const sender = await User.findById(request.sender);
        const receiver = await User.findById(req.user.id);

        if (sender && receiver) {
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
    } else if (status === 'rejected') {
        await Request.create({
            sender: req.user.id,
            receiver: request.sender,
            type: 'notification',
            message: `Your partnership request was declined. You may try again later.`,
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

module.exports = {
    sendRequest,
    getReceivedRequests,
    getSentRequests,
    getPublicPitches,
    claimPublicPitch,
    respondToRequest,
    markAsRead,
    checkConnection,
    endRelationship,
    cancelRequest,
    updateRelationshipNote
};
