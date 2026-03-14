const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const User = require('../models/User');
const Request = require('../models/Request');

// Create a new plan (initial version 0.0)
const createPlan = async (req, res) => {
    try {
        const { partnerId, title, content } = req.body;
        const currentUserId = req.user.id;

        // Verify partnership relationship
        const user1 = await User.findById(currentUserId);
        const user2 = await User.findById(partnerId);

        if (!user1 || !user2) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if users are enrolled as partners
        const isEnrolled = user1.enrolledPartners.some(p => p.user && p.user.toString() === partnerId);
        if (!isEnrolled) {
            return res.status(403).json({ message: 'This user is not your partner' });
        }

        // Check if plan already exists
        const existingPlan = await Plan.findOne({
            $or: [
                { partner1: currentUserId, partner2: partnerId },
                { partner1: partnerId, partner2: currentUserId }
            ]
        });
        if (existingPlan) {
            return res.status(400).json({ message: 'Plan already exists for this mentorship' });
        }

        const plan = new Plan({
            partner1: currentUserId,
            partner2: partnerId,
            versions: [{
                versionMajor: 0,
                versionMinor: 0,
                title,
                content,
                comments: []
            }]
        });

        await plan.save();

        // Add plan reference to both users
        user1.activePlans = user1.activePlans || [];
        user1.activePlans.push(plan._id);
        await user1.save();

        user2.activePlans = user2.activePlans || [];
        user2.activePlans.push(plan._id);
        await user2.save();

        res.status(201).json(plan);
    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Add a new version to existing plan
const addVersion = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, isMajor } = req.body;
        const currentUserId = req.user.id;

        const plan = await Plan.findById(id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // Verify the requester is one of the partners
        if (plan.partner1.toString() !== currentUserId && plan.partner2.toString() !== currentUserId) {
            return res.status(403).json({ message: 'Only partners can add versions' });
        }

        // Calculate next version number
        const lastVersion = plan.versions[plan.versions.length - 1];
        const newMajor = isMajor ? lastVersion.versionMajor + 1 : lastVersion.versionMajor;
        const newMinor = isMajor ? 0 : lastVersion.versionMinor + 1;

        // Create notification for the other partner
        const author = await User.findById(currentUserId);

        plan.versions.push({
            versionMajor: newMajor,
            versionMinor: newMinor,
            title,
            content,
            authorName: author.name,
            comments: []
        });

        await plan.save();

        if (plan.projectRef) {
            // Project plan notification logic
            // We could notify everyone, but for now just log it or notify Lead if not author
        } else {
            const otherPartnerId = plan.partner1.toString() === currentUserId ? plan.partner2 : plan.partner1;
            await Request.create({
                sender: currentUserId,
                receiver: otherPartnerId,
                type: 'notification',
                message: `${author.name} published a new version (v${newMajor}.${newMinor}) of your collaboration plan|||PLAN:${plan._id}`,
                status: 'pending',
                isPublic: false
            });
        }

        // Populate all required fields before returning
        await plan.populate('partner1', 'name username');
        await plan.populate('partner2', 'name username');
        await plan.populate('versions.comments.author', 'name username');

        res.json(plan);
    } catch (error) {
        console.error('Add version error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Edit an existing version (in-place, no new version)
const editVersion = async (req, res) => {
    try {
        const { id, versionIdx } = req.params;
        const { title, content } = req.body;
        const currentUserId = req.user.id;

        const plan = await Plan.findById(id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // Verify the requester is one of the partners
        if (plan.partner1.toString() !== currentUserId && plan.partner2.toString() !== currentUserId) {
            return res.status(403).json({ message: 'Only partners can edit versions' });
        }

        const version = plan.versions[versionIdx];
        if (!version) {
            return res.status(404).json({ message: 'Version not found' });
        }

        // Update version in place
        version.title = title;
        version.content = content;

        await plan.save();

        // Populate all required fields before returning
        await plan.populate('partner1', 'name username');
        await plan.populate('partner2', 'name username');
        await plan.populate('versions.comments.author', 'name username');

        res.json(plan);
    } catch (error) {
        console.error('Edit version error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete a version
const deleteVersion = async (req, res) => {
    try {
        const { id, versionIdx } = req.params;
        const currentUserId = req.user.id;

        const plan = await Plan.findById(id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // Verify the requester is one of the partners
        if (plan.partner1.toString() !== currentUserId && plan.partner2.toString() !== currentUserId) {
            return res.status(403).json({ message: 'Only partners can delete versions' });
        }

        // Cannot delete if it's the only version
        if (plan.versions.length === 1) {
            return res.status(400).json({ message: 'Cannot delete the only version. Delete the entire plan instead.' });
        }

        // Remove version at index
        plan.versions.splice(versionIdx, 1);

        await plan.save();

        // Populate and return
        await plan.populate('partner1', 'name username');
        await plan.populate('partner2', 'name username');
        await plan.populate('versions.comments.author', 'name username');

        res.json(plan);
    } catch (error) {
        console.error('Delete version error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get plan by ID
const getPlan = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid plan ID format' });
        }

        const plan = await Plan.findById(id)
            .populate('partner1', 'name username')
            .populate('partner2', 'name username')
            .populate('student', 'name username')
            .populate('mentor', 'name username')
            .populate('versions.comments.author', 'name username');

        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // Verify user is one of the partners (or legacy student/mentor) or project member
        const isPartner =
            (plan.partner1 && plan.partner1._id.toString() === userId) ||
            (plan.partner2 && plan.partner2._id.toString() === userId);

        const isLegacy =
            (plan.student && plan.student._id.toString() === userId) ||
            (plan.mentor && plan.mentor._id.toString() === userId);

        let isProjectMember = false;
        if (plan.projectRef) {
            const project = await Request.findById(plan.projectRef);
            if (project) {
                isProjectMember =
                    project.sender.toString() === userId ||
                    project.contributors.some(c => c.toString() === userId) ||
                    (project.mentor && project.mentor.toString() === userId);
            }
        }

        if (!isPartner && !isLegacy && !isProjectMember) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(plan);
    } catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get plan by mentor-mentee pair
const getPlanByPair = async (req, res) => {
    try {
        const { partnerId: otherId } = req.params;
        const userId = req.user.id;

        // Try both directions: current user as partner1 OR partner2
        let plan = await Plan.findOne({ partner1: userId, partner2: otherId })
            .populate('partner1', 'name username')
            .populate('partner2', 'name username')
            .populate('student', 'name username')
            .populate('mentor', 'name username')
            .populate('versions.comments.author', 'name username');

        // If not found, try reverse
        if (!plan) {
            plan = await Plan.findOne({ partner1: otherId, partner2: userId })
                .populate('partner1', 'name username')
                .populate('partner2', 'name username')
                .populate('student', 'name username')
                .populate('mentor', 'name username')
                .populate('versions.comments.author', 'name username');
        }

        // If still not found, try legacy (mentor/student)
        if (!plan) {
            plan = await Plan.findOne({ mentor: userId, student: otherId })
                .populate('partner1', 'name username')
                .populate('partner2', 'name username')
                .populate('student', 'name username')
                .populate('mentor', 'name username')
                .populate('versions.comments.author', 'name username');
        }

        if (!plan) {
            plan = await Plan.findOne({ mentor: otherId, student: userId })
                .populate('partner1', 'name username')
                .populate('partner2', 'name username')
                .populate('student', 'name username')
                .populate('mentor', 'name username')
                .populate('versions.comments.author', 'name username');
        }

        if (!plan) {
            return res.status(404).json({ message: 'No collaboration plan found' });
        }

        console.log(`Plan found: ${plan._id}`);
        res.json(plan);
    } catch (error) {
        console.error('Get plan by pair error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get or create a plan for a project team
// @route   GET /api/plans/project/:projectId
// @access  Private
const getProjectPlan = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.id;

        const project = await Request.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check membership
        const isMember =
            project.sender.toString() === userId ||
            project.contributors.some(c => c.toString() === userId) ||
            (project.mentor && project.mentor.toString() === userId);

        if (!isMember) {
            return res.status(403).json({ message: 'Access denied - you are not a member of this project' });
        }

        let plan = await Plan.findOne({ projectRef: projectId })
            .populate('projectRef')
            .populate('versions.comments.author', 'name username avatar');

        if (!plan) {
            // Create default plan for project
            const pitchTitle = project.pitch?.get('Hook') || project.pitch?.get('The Hook (Short summary)') || "Mission";
            plan = new Plan({
                projectRef: projectId,
                versions: [{
                    versionMajor: 0,
                    versionMinor: 0,
                    title: `${pitchTitle} Collaboration Workspace`,
                    content: `# ${pitchTitle}\n\nWelcome to your shared project plan. Start collaborating here!`,
                    authorName: 'System',
                    comments: []
                }]
            });
            await plan.save();
        }

        res.json(plan);
    } catch (error) {
        console.error('Get project plan error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Add comment to a specific version
const addComment = async (req, res) => {
    try {
        const { id, versionIdx } = req.params;
        const { text } = req.body;
        const userId = req.user.id;

        const plan = await Plan.findById(id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // Verify user is one of the partners
        if (plan.partner1.toString() !== userId && plan.partner2.toString() !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const version = plan.versions[versionIdx];
        if (!version) {
            return res.status(404).json({ message: 'Version not found' });
        }

        const user = await User.findById(userId);
        version.comments.push({
            author: userId,
            authorName: user.name,
            text
        });

        await plan.save();

        // Send notification to the other party
        const recipientId = plan.partner1.toString() === userId ? plan.partner2 : plan.partner1;
        const versionLabel = `v${version.versionMajor}.${version.versionMinor}`;

        await Request.create({
            sender: userId,
            receiver: recipientId,
            type: 'notification',
            message: `${user.name} commented on ${versionLabel} of your collaboration plan|||PLAN:${plan._id}`,
            status: 'pending',
            isPublic: false
        });

        // Populate all required fields before returning
        await plan.populate('partner1', 'name username');
        await plan.populate('partner2', 'name username');
        await plan.populate('versions.comments.author', 'name username');

        res.json(plan);
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    createPlan,
    addVersion,
    editVersion,
    deleteVersion,
    getPlan,
    getPlanByPair,
    getProjectPlan,
    addComment
};
