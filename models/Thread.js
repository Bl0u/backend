const mongoose = require('mongoose');

const threadSchema = mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String }, // Optional longer description
    content: { type: String }, // Initial body/post (Optional in 1.4)
    instructions: { type: String }, // Participation guides (Markdown)
    type: { type: String, enum: ['college', 'interview', 'specific', 'general', 'discussion', 'resource'], default: 'discussion' },
    tags: [{ type: String }], // e.g. ["#Java", "#IELTS"]
    isCurated: { type: Boolean, default: false }, // For "Curated Topics"
    attachments: [{ type: String }], // Array of URLs
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    guideVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    acknowledgedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Users who acknowledged instructions
}, {
    timestamps: true,
});

module.exports = mongoose.model('Thread', threadSchema);
