const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    mentor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    mentee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    versions: [{
        versionMajor: {
            type: Number,
            default: 0
        },
        versionMinor: {
            type: Number,
            default: 0
        },
        title: {
            type: String,
            required: true
        },
        content: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        comments: [{
            author: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            authorName: String,
            text: {
                type: String,
                required: true
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }]
    }]
}, {
    timestamps: true
});

// Method to get version string (e.g., "0.1")
planSchema.methods.getVersionString = function (versionIdx) {
    const version = this.versions[versionIdx];
    return `${version.versionMajor}.${version.versionMinor}`;
};

module.exports = mongoose.model('Plan', planSchema);
