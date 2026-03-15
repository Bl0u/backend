const mongoose = require('mongoose');

const groupChatSchema = mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // System-created groups might not have a creator
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    groupType: {
        type: String,
        // enum: ['level', 'custom', 'elite'], // Removed strict enum to support dynamic types
        default: 'custom'
    },
    targetRoles: [{ 
        type: String, 
        enum: ['student', 'admin', 'mentor', 'studentLead', 'moderator'] 
    }],
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
    isOfficial: { type: Boolean, default: false },
    avatar: { type: String, default: 'https://via.placeholder.com/150' },
    privacyType: { type: String, enum: ['public', 'private'], default: 'public' },

    // Metadata for official groups (University, School, etc.)
    metadata: {
        university: { type: String },
        college: { type: String },
        academicLevel: { type: String }, // Level 1, 2, 3, 4
        grade: { type: String },
        institution: { type: String }
    },

    // Legacy support
    academicLevel: { type: String }, // For 'level' type groups (internal)
    bannedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, {
    timestamps: true,
});

module.exports = mongoose.model('GroupChat', groupChatSchema);
