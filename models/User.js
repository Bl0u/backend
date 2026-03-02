const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    avatar: { type: String, default: 'https://via.placeholder.com/150' },
    gender: { type: String, enum: ['Male', 'Female'] },
    isPrivate: { type: Boolean, default: false },

    // ===== STUDENT/PARTNER PROFILE FIELDS =====

    // 1️⃣ Identity & Academic Context
    // 1️⃣ Core Identity
    major: { type: String },
    academicLevel: { type: String, enum: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Graduated'] },
    university: { type: String },
    bio: { type: String, maxlength: 200 }, // Renamed from studyNote

    // 2️⃣ Partner Needs
    partnerType: { type: String, enum: ['peer', 'project teammate'] },
    matchingGoal: { type: String },
    topics: [{ type: String }],
    neededFromPartner: { type: String },

    // 3️⃣ Location & Logistics
    timezone: { type: String },
    languages: [{ type: String }],
    studyMode: { type: String, enum: ['In-person', 'Online', 'Hybrid'] },
    preferredTools: [{ type: String }],

    // 4️⃣ Availability & Commitment
    availability: {
        days: [{ type: String }],
        timeRanges: [{ type: String }]
    },
    commitmentLevel: { type: String, enum: ['Casual', 'Balanced', 'Heavy'] },

    // 5️⃣ Style & Offsets
    sessionsPerWeek: { type: Number },
    sessionLength: { type: String },
    pace: { type: String, enum: ['Slow & deep', 'Balanced', 'Fast'] },
    canOffer: { type: String },

    // Legacy/Matching
    lookingForPartner: { type: Boolean, default: false },

    // ===== COMMON FIELDS =====
    socialLinks: [{
        platform: { type: String, required: true },
        url: { type: String, required: true }
    }],
    skills: [{ type: String }],
    interests: [{ type: String }],

    // Partnership Relationship Tracking
    enrolledPartners: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['active', 'completed'], default: 'active' },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date }
    }],

    // Collaborative Planning (Shared with partner)
    pitchQuestions: [{
        questionType: { type: String, enum: ['text', 'mcq', 'checkbox'], required: true },
        questionText: { type: String, required: true },
        options: [{ type: String }]
    }],
    activePlans: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan'
    }],
    partnerHistory: [{
        partnerName: { type: String },
        partnerUsername: { type: String },
        startDate: { type: Date },
        endDate: { type: Date }
    }],
    planTemplate: { type: String },

    // ===== V2.0: MONETIZATION FIELDS =====
    stars: { type: Number, default: 0 },
    purchasedThreads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }],
    pinnedThreads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }]
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', userSchema);


