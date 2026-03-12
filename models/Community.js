const mongoose = require('mongoose');

const communitySchema = mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    avatar: { type: String, default: 'https://via.placeholder.com/150' },
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GroupChat' }],
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Usually admin
}, {
    timestamps: true
});

module.exports = mongoose.model('Community', communitySchema);
