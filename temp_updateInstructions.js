// @desc    Update thread instructions
// @route   PUT /api/resources/thread/:id/instructions
// @access  Private (Owner/Moderator only)
const updateInstructions = async (req, res) => {
    try {
        const thread = await Thread.findById(req.params.id);
        if (!thread) {
            return res.status(404).json({ message: 'Thread not found' });
        }

        // Check authorization
        const isMod = thread.author.toString() === req.user.id || thread.moderators.includes(req.user.id);
        if (!isMod) {
            return res.status(403).json({ message: 'Unauthorized: Only owner or moderators can update instructions' });
        }

        thread.instructions = req.body.instructions;
        await thread.save();
        res.json({ message: 'Instructions updated successfully', thread });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
