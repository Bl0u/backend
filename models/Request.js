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
        enum: ['mentorship', 'partner', 'review_alert', 'notification'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'completed'],
        default: 'pending'
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
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Request', requestSchema);
