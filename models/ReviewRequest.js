const mongoose = require('mongoose');

const reviewRequestSchema = mongoose.Schema({
    thread: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Thread',
        required: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'resolved', 'dismissed'],
        default: 'pending'
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ReviewRequest', reviewRequestSchema);
