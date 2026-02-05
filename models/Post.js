const mongoose = require('mongoose');

const postSchema = mongoose.Schema({
    thread: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Thread',
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contentType: {
        type: String,
        enum: ['text', 'file', 'note', 'image'],
        default: 'text'
    },
    content: {
        type: String,
        required: true
    },
    upvotes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    upvoteCount: {
        type: Number,
        default: 0
    },
    attachments: [{
        type: String // URLs to uploaded files/images
    }],
    parentPost: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Post', postSchema);
