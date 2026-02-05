const Request = require('../models/Request');
const User = require('../models/User');

// @desc    Send a request (Mentorship or Partner)
// @route   POST /api/requests
// @access  Private
const sendRequest = async (req, res) => {
    const { receiverId, type, message, pitch, isPublic } = req.body;

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
        const fieldName = type === 'mentorship' ? 'enrolledMentees' : 'enrolledPartners';
        const isCurrentlyEnrolled = currentUser[fieldName]?.some(
            entry => entry.user.toString() === receiverId && entry.status === 'active'
        );

        if (isCurrentlyEnrolled) {
            return res.status(400).json({ message: `You already have an active ${type} with this user` });
        }
    }

    const request = await Request.create({
        sender: req.user.id,
        receiver: isPublic ? undefined : receiverId,
        type,
        message,
        pitch,
        isPublic: !!isPublic
    });

    res.status(201).json(request);
};

// @desc    Get received requests (Private)
// @route   GET /api/requests/received
// @access  Private
const getReceivedRequests = async (req, res) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const requests = await Request.find({ receiver: req.user.id })
        .populate('sender', 'name username avatar role major academicLevel')
        .sort({ createdAt: -1 });
    res.json(requests);
};

// @desc    Get sent requests (Private)
// @route   GET /api/requests/sent
// @access  Private
const getSentRequests = async (req, res) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const requests = await Request.find({ sender: req.user.id })
        .populate('receiver', 'name username avatar role major academicLevel')
        .sort({ createdAt: -1 });
    res.json(requests);
};

// @desc    Get all public pitches (Pitch Hub)
// @route   GET /api/requests/public
// @access  Public
const getPublicPitches = async (req, res) => {
    const pitches = await Request.find({ isPublic: true, status: 'pending' })
        .populate('sender', 'name username avatar role major academicLevel')
        .sort({ createdAt: -1 });
    res.json(pitches);
};

// @desc    Claim a public pitch (Mentor)
// @route   PUT /api/requests/:id/claim
// @access  Private (Mentors Only)
const claimPublicPitch = async (req, res) => {
    const request = await Request.findById(req.params.id);

    if (!request || !request.isPublic || request.status !== 'pending') {
        return res.status(404).json({ message: 'Public pitch not found or already claimed' });
    }

    // Role check: Only mentors can claim
    const user = await User.findById(req.user.id);
    if (user.role !== 'mentor') {
        return res.status(403).json({ message: 'Only mentors can claim public pitches' });
    }

    request.receiver = req.user.id;
    request.claimedBy = req.user.id;
    request.status = 'accepted';
    await request.save();

    // Enroll Student and Mentor
    const student = await User.findById(request.sender);
    if (student) {
        // Add to mentor's enrolledMentees
        user.enrolledMentees.push({ user: student._id, status: 'active' });

        // Add to mentor history (Track Record)
        user.mentorshipHistory.push({
            projectName: request.pitch?.get('Hook') || 'Pro-Bono Mentorship',
            menteeName: student.name,
            menteeUsername: student.username,
            pitchAnswers: request.pitch // Store full pitch
        });
        await user.save();

        // Add to student's enrolledMentors
        student.enrolledMentors.push({ user: user._id, status: 'active' });
        await student.save();

        // Create notification for student inbox
        await Request.create({
            sender: req.user.id,
            receiver: student._id,
            type: 'mentorship',
            message: `MISSION ACCEPTED: I have claimed your pitch "${request.pitch?.get('Hook')}". Check your dashboard!`,
            status: 'accepted',
            isPublic: false
        });
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
        // Fetch users at the start so they're available for all logic below
        const sender = await User.findById(request.sender);
        const receiver = await User.findById(req.user.id);

        // Handle enrollment (mentorship or partnership)
        if (sender && receiver) {
            if (request.type === 'mentorship') {
                const activeMentee = receiver.enrolledMentees.find(m => m.user.toString() === sender._id.toString() && m.status === 'active');
                if (!activeMentee) {
                    receiver.enrolledMentees.push({ user: sender._id, status: 'active' });
                    receiver.mentorshipHistory.push({
                        projectName: request.pitch?.get('Hook') || 'Mentorship Request',
                        menteeName: sender.name,
                        menteeUsername: sender.username,
                        pitchAnswers: request.pitch
                    });
                    await receiver.save();

                    sender.enrolledMentors.push({ user: receiver._id, status: 'active' });
                    await sender.save();
                }
            } else if (request.type === 'partner') {
                const activePartner = receiver.enrolledPartners.find(p => p.user.toString() === sender._id.toString() && p.status === 'active');
                if (!activePartner) {
                    receiver.enrolledPartners.push({ user: sender._id, status: 'active' });
                    await receiver.save();

                    sender.enrolledPartners.push({ user: receiver._id, status: 'active' });
                    await sender.save();
                }
            }
        }

        // Send inbox notification to sender
        let notificationMessage = `Your ${request.type} request has been accepted! 🎉`;

        // For mentorship acceptance, create default plan and add ID to notification
        if (request.type === 'mentorship' && receiver) {
            try {
                const Plan = require('../models/Plan');
                const existingPlan = await Plan.findOne({ mentor: req.user.id, mentee: request.sender });

                if (!existingPlan) {
                    const defaultContent = `# Welcome!

This is your personalized mentorship roadmap. Your mentor will update this regularly with goals, milestones, and resources.

## Getting Started

Your mentor will customize this plan based on your goals and the project pitch you submitted.`;

                    const newPlan = new Plan({
                        mentor: req.user.id,
                        mentee: request.sender,
                        versions: [{
                            versionMajor: 0,
                            versionMinor: 0,
                            title: 'Initial Mentorship Plan',
                            content: receiver.planTemplate || defaultContent,
                            authorName: receiver.name,
                            comments: []
                        }]
                    });
                    await newPlan.save();

                    notificationMessage = `Your mentorship request has been accepted! 🎉 Check your initial plan.|||PLAN:${newPlan._id}`;
                } else {
                    notificationMessage = `Your mentorship request has been accepted! 🎉 Check your plan.|||PLAN:${existingPlan._id}`;
                }
            } catch (error) {
                console.error('Plan creation error in acceptance:', error);
                // Continue with notification even if plan creation fails
            }
        }

        await Request.create({
            sender: req.user.id,
            receiver: request.sender,
            type: 'notification',
            message: notificationMessage,
            status: 'accepted',
            isPublic: false
        });
    } else if (status === 'rejected') {
        await Request.create({
            sender: req.user.id,
            receiver: request.sender,
            type: 'notification',
            message: `Your ${request.type} request was declined. You may try again later.`,
            status: 'rejected',
            isPublic: false
        });
    }

    res.json(request);
};

// @desc    Mark notification as read (delete it)
// @route   DELETE /api/requests/:id/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Verify the user is the receiver
        if (request.receiver.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Allow marking any request as read (remove type restriction)
        await Request.findByIdAndDelete(req.params.id);

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    End an active mentorship or partnership
// @route   PUT /api/requests/relationship/end
// @access  Private
const endRelationship = async (req, res) => {
    const { targetUserId, type } = req.body; // type: 'mentorship' or 'partner'
    const currentUser = await User.findById(req.user.id);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) {
        return res.status(404).json({ message: 'User not found' });
    }

    let relationshipFound = false;

    if (type === 'mentorship') {
        // Handle mentorship ending
        if (currentUser.role === 'mentor') {
            const mentee = currentUser.enrolledMentees.find(m => m.user.toString() === targetUserId && m.status === 'active');
            if (mentee) {
                mentee.status = 'completed';
                mentee.endDate = new Date();
                relationshipFound = true;
            }
        } else {
            const mentor = currentUser.enrolledMentors.find(m => m.user.toString() === targetUserId && m.status === 'active');
            if (mentor) {
                mentor.status = 'completed';
                mentor.endDate = new Date();
                relationshipFound = true;
            }
        }

        if (targetUser.role === 'mentor') {
            const mentee = targetUser.enrolledMentees.find(m => m.user.toString() === req.user.id && m.status === 'active');
            if (mentee) {
                mentee.status = 'completed';
                mentee.endDate = new Date();
            }
        } else {
            const mentor = targetUser.enrolledMentors.find(m => m.user.toString() === req.user.id && m.status === 'active');
            if (mentor) {
                mentor.status = 'completed';
                mentor.endDate = new Date();
            }
        }

        // Update mentor history
        const mentor = currentUser.role === 'mentor' ? currentUser : targetUser;
        const student = currentUser.role === 'mentor' ? targetUser : currentUser;
        const historyItem = mentor.mentorshipHistory.reverse().find(h => h.menteeUsername === student.username);
        if (historyItem) {
            historyItem.endDate = new Date();
        }

    } else if (type === 'partner') {
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
    }

    if (!relationshipFound) {
        return res.status(400).json({ message: `No active ${type} found with this user` });
    }

    // Mark ALL relevant requests as 'completed' to unblock new requests
    await Request.updateMany(
        {
            $or: [
                { sender: req.user.id, receiver: targetUserId, type, status: { $in: ['accepted', 'pending'] } },
                { sender: targetUserId, receiver: req.user.id, type, status: { $in: ['accepted', 'pending'] } }
            ]
        },
        { status: 'completed' }
    );

    await currentUser.save();
    await targetUser.save();

    // Send notification to the other user
    const relationshipType = type === 'mentorship' ? 'mentorship' : 'partnership';
    await Request.create({
        sender: req.user.id,
        receiver: targetUserId,
        type: 'notification',
        message: `Your ${relationshipType} with ${currentUser.name} has ended. Thank you for your collaboration! 🤝`,
        status: 'completed',
        isPublic: false
    });

    res.json({ message: `${type} successfully completed`, currentUser });
};

// @desc    Update a mentorship history note
// @route   PUT /api/requests/history/note
// @access  Private (Mentors Only)
const updateMentorshipNote = async (req, res) => {
    const { historyId, notes } = req.body;
    const user = await User.findById(req.user.id);

    if (!user || user.role !== 'mentor') {
        return res.status(403).json({ message: 'Only mentors can add notes to history' });
    }

    const historyItem = user.mentorshipHistory.id(historyId);
    if (!historyItem) {
        return res.status(404).json({ message: 'History record not found' });
    }

    historyItem.notes = notes;
    await user.save();

    res.json({ message: 'Note updated successfully', historyItem });
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
        return res.status(400).json({ message: 'Only pending requests can be cancelled. Active mentorships must be ended via the dashboard.' });
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
    updateMentorshipNote,
    cancelRequest
};
