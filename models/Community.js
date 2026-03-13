const mongoose = require('mongoose');

const communitySchema = mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    avatar: { type: String, default: 'https://via.placeholder.com/150' },
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GroupChat' }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Usually admin
    privacyType: { type: String, enum: ['public', 'private'], default: 'public' },
    bannedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Community', communitySchema);
