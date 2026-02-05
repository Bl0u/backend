const mongoose = require('mongoose');

const mentorshipRequestSchema = mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectTitle: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['pending', 'reviewed', 'accepted'], default: 'pending' },
    isPublic: { type: Boolean, default: true },
}, {
    timestamps: true,
});

module.exports = mongoose.model('MentorshipRequest', mentorshipRequestSchema);
