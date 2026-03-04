const mongoose = require('mongoose');

const reportSchema = mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reportedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        required: true,
        enum: ['Spam', 'Inappropriate Content', 'Harassment', 'Fake Profile', 'Other']
    },
    details: {
        type: String,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'dismissed'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);
