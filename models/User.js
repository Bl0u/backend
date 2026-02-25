const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    avatar: { type: String, default: 'https://via.placeholder.com/150' },

    // ===== STUDENT/PARTNER PROFILE FIELDS =====

    // 1️⃣ Identity & Academic Context
    major: { type: String },
    academicLevel: { type: String, enum: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Graduated'] },
    university: { type: String },

    // 2️⃣ Current Academic Context
    currentCourses: [{ type: String }],

    // 3️⃣ Study & Collaboration Intent
    primaryStudyGoal: {
        type: String,
        enum: ['Exam preparation', 'Assignments', 'Concept mastery', 'Catching up', 'Grade improvement', 'Interview preparation', 'Internship preparation', 'Field-specific learning', 'Language learning']
    },
    secondaryStudyGoal: {
        type: String,
        enum: ['Exam preparation', 'Assignments', 'Concept mastery', 'Catching up', 'Grade improvement', 'Interview preparation', 'Internship preparation', 'Field-specific learning', 'Language learning']
    },
    fieldSpecificDetails: { type: String },

    // 4️⃣ Study & Partnership Style
    preferredStudyStyle: {
        type: String,
        enum: ['Silent co-study', 'Discussion-based', 'Teaching/explaining', 'Problem-solving focused']
    },
    studyPacePreference: {
        type: String,
        enum: ['Slow & deep', 'Balanced', 'Fast & exam-oriented']
    },

    // 5️⃣ Logistics
    availability: {
        days: [{ type: String }],
        timeRanges: [{ type: String }]
    },
    studyMode: { type: String, enum: ['In-person', 'Online', 'Hybrid'] },
    preferredTools: [{ type: String }],

    // 6️⃣ Communication & Commitment
    communicationStyle: { type: String, enum: ['Direct', 'Friendly', 'Structured'] },
    commitmentLevel: { type: String, enum: ['Casual', 'Weekly sessions', 'Intensive (exam periods)'] },

    // 7️⃣ Language & Accessibility
    languages: [{ type: String }],
    accessibilityPreferences: { type: String },

    // 8️⃣ Learning Compatibility 
    learningTraits: [{ type: String }],

    // 9️⃣ Short Note
    studyNote: { type: String, maxlength: 200 },

    // Partner Matching
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
    purchasedThreads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }]
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', userSchema);


