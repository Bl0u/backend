const mongoose = require('mongoose');

const groupChatSchema = mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // System-created groups might not have a creator
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    groupType: {
        type: String,
        enum: ['level', 'custom', 'elite'],
        default: 'custom'
    },
    academicLevel: { type: String }, // For 'level' type groups
    isOfficial: { type: Boolean, default: false },
    avatar: { type: String, default: 'https://via.placeholder.com/150' }
}, {
    timestamps: true,
});

module.exports = mongoose.model('GroupChat', groupChatSchema);
