const Plan = require('../models/Plan');
const User = require('../models/User');
const Request = require('../models/Request');

// Create a new plan (initial version 0.0)
const createPlan = async (req, res) => {
    try {
        const { menteeId, title, content } = req.body;
        const mentorId = req.user.id;

        // Verify mentor-mentee relationship
        const mentor = await User.findById(mentorId);
        const mentee = await User.findById(menteeId);

        if (!mentor || !mentee) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if mentor has this mentee enrolled
        const isEnrolled = mentor.enrolledMentees.some(m => m.user && m.user.toString() === menteeId);
        if (!isEnrolled) {
            return res.status(403).json({ message: 'This student is not enrolled with you' });
        }

        // Check if plan already exists
        const existingPlan = await Plan.findOne({ mentor: mentorId, mentee: menteeId });
        if (existingPlan) {
            return res.status(400).json({ message: 'Plan already exists for this mentorship' });
        }

        const plan = new Plan({
            mentor: mentorId,
            mentee: menteeId,
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
        mentor.activePlans = mentor.activePlans || [];
        mentor.activePlans.push(plan._id);
        await mentor.save();

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
        const mentorId = req.user.id;

        const plan = await Plan.findById(id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // Verify the requester is the mentor
        if (plan.mentor.toString() !== mentorId) {
            return res.status(403).json({ message: 'Only the mentor can add versions' });
        }

        // Calculate next version number
        const lastVersion = plan.versions[plan.versions.length - 1];
        const newMajor = isMajor ? lastVersion.versionMajor + 1 : lastVersion.versionMajor;
        const newMinor = isMajor ? 0 : lastVersion.versionMinor + 1;

        // Get mentor info for author name
        const mentor = await User.findById(mentorId);

        plan.versions.push({
            versionMajor: newMajor,
            versionMinor: newMinor,
            title,
            content,
            authorName: mentor.name,
            comments: []
        });

        await plan.save();

        // Send notification to student
        await Request.create({
            sender: mentorId,
            receiver: plan.mentee,
            type: 'notification',
            message: `Your mentor has published a new version (v${newMajor}.${newMinor}) of your mentorship plan|||PLAN:${plan._id}`,
            status: 'accepted',
            isPublic: false
        });

        // Populate all required fields before returning
        await plan.populate('mentor', 'name username');
        await plan.populate('mentee', 'name username');
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
        const mentorId = req.user.id;

        const plan = await Plan.findById(id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // Verify the requester is the mentor
        if (plan.mentor.toString() !== mentorId) {
            return res.status(403).json({ message: 'Only the mentor can edit versions' });
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
        await plan.populate('mentor', 'name username');
        await plan.populate('mentee', 'name username');
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
        const mentorId = req.user.id;

        const plan = await Plan.findById(id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // Verify the requester is the mentor
        if (plan.mentor.toString() !== mentorId) {
            return res.status(403).json({ message: 'Only the mentor can delete versions' });
        }

        // Cannot delete if it's the only version
        if (plan.versions.length === 1) {
            return res.status(400).json({ message: 'Cannot delete the only version. Delete the entire plan instead.' });
        }

        // Remove version at index
        plan.versions.splice(versionIdx, 1);

        await plan.save();

        // Populate and return
        await plan.populate('mentor', 'name username');
        await plan.populate('mentee', 'name username');
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

        const plan = await Plan.findById(id)
            .populate('mentor', 'name username')
            .populate('mentee', 'name username')
            .populate('versions.comments.author', 'name username');

        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // Verify user is either mentor or mentee
        if (plan.mentor._id.toString() !== userId && plan.mentee._id.toString() !== userId) {
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
        const { menteeId } = req.params; // This is actually the "other user" ID
        const userId = req.user.id;

        console.log(`getPlanByPair called: userId=${userId}, menteeId=${menteeId}`);

        // Try both directions: user as mentor OR user as mentee
        let plan = await Plan.findOne({ mentor: userId, mentee: menteeId })
            .populate('mentor', 'name username')
            .populate('mentee', 'name username')
            .populate('versions.comments.author', 'name username');

        // If not found, try reverse (user is mentee, other is mentor)
        if (!plan) {
            console.log('Not found as mentor, trying as mentee...');
            plan = await Plan.findOne({ mentor: menteeId, mentee: userId })
                .populate('mentor', 'name username')
                .populate('mentee', 'name username')
                .populate('versions.comments.author', 'name username');
        }

        if (!plan) {
            console.log('No plan found in either direction');
            return res.status(404).json({ message: 'No plan found for this mentorship' });
        }

        console.log(`Plan found: ${plan._id}`);
        res.json(plan);
    } catch (error) {
        console.error('Get plan by pair error:', error);
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

        // Verify user is either mentor or mentee
        if (plan.mentor.toString() !== userId && plan.mentee.toString() !== userId) {
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

        // Send notification to the other party (mentor or mentee)
        const recipientId = plan.mentor.toString() === userId ? plan.mentee : plan.mentor;
        const versionLabel = `v${version.versionMajor}.${version.versionMinor}`;

        await Request.create({
            sender: userId,
            receiver: recipientId,
            type: 'notification',
            message: `${user.name} commented on ${versionLabel} of your mentorship plan|||PLAN:${plan._id}`,
            status: 'accepted',
            isPublic: false
        });

        // Populate all required fields before returning
        await plan.populate('mentor', 'name username');
        await plan.populate('mentee', 'name username');
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
    addComment
};
