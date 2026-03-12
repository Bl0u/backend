const mongoose = require('mongoose');

const requestSchema = mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () { return !this.isPublic; } // Only required if not public
    },
    type: {
        type: String,
        enum: ['mentorship', 'partner', 'review_alert', 'notification', 'pitch_claim', 'community_join'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'completed', 'ongoing'],
        default: 'pending'
    },
    groupChat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GroupChat'
    },
    answers: {
        type: Map,
        of: String
    },
    pitchRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Request'
    },
    claimRole: {
        type: String,
        enum: ['teammate', 'mentor']
    },
    roleName: {
        type: String
    },
    message: {
        type: String
    },
    pitch: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    claimedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    teamSize: {
        type: Number,
        default: 1
    },
    mentorNeeded: {
        type: Boolean,
        default: false
    },
    progress: {
        type: Number,
        default: 0
    },
    isProBono: {
        type: Boolean,
        default: false
    },
    contributors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    mentor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    roles: [{
        name: String,
        requirements: String,
        roleType: { type: String, enum: ['teammate', 'mentor'], default: 'teammate' },
        isFilled: { type: Boolean, default: false },
        filledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Request', requestSchema);
