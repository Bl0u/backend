const mongoose = require('mongoose');

const threadSchema = mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String }, // Optional longer description
    content: { type: String }, // Initial body/post (Optional in 1.4)
    instructions: { type: String }, // Participation guides (Markdown)
    type: { type: String, enum: ['college', 'interview', 'specific', 'general', 'discussion', 'resource'], default: 'discussion' },
    tags: [{ type: String }], // e.g. ["#Java", "#IELTS"]
    position: { type: String }, // e.g. "Frontend Engineer" for interview prep
    company: { type: String }, // e.g. "Google" for interview prep
    isCurated: { type: Boolean, default: false }, // For "Curated Topics"
    attachments: [{ type: String }], // Array of URLs
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    guideVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    acknowledgedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who acknowledged instructions

    // V2.0: Monetization
    isPaid: { type: Boolean, default: false },
    price: { type: Number, default: 0 }, // Cost in stars
    purchasers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // V2.1: Targeted Resource Demographics (For Student Lead Access)
    university: { type: String },
    college: { type: String },
    academicLevel: { type: String },

    // V2.2: Revenue Sharing Configuration
    earningsConfig: {
        enabled: { type: Boolean, default: false },
        earnerSharePercent: { type: Number, default: 10 }, // % given to earners (1-90), platform always gets 10%
        participatingEarners: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // any users author picks
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Thread', threadSchema);
