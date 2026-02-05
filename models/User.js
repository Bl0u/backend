const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'mentor', 'admin'], default: 'student' },
    avatar: { type: String, default: 'https://via.placeholder.com/150' },

    // ===== STUDENT PROFILE FIELDS =====

    // 1️⃣ Identity & Academic Context
    major: { type: String },
    academicLevel: { type: String, enum: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Graduated'] },
    university: { type: String },

    // 2️⃣ Current Academic Context
    currentCourses: [{ type: String }],

    // 3️⃣ Study Intent
    primaryStudyGoal: {
        type: String,
        enum: ['Exam preparation', 'Assignments', 'Concept mastery', 'Catching up', 'Grade improvement', 'Interview preparation', 'Internship preparation', 'Field-specific learning', 'Language learning']
    },
    secondaryStudyGoal: {
        type: String,
        enum: ['Exam preparation', 'Assignments', 'Concept mastery', 'Catching up', 'Grade improvement', 'Interview preparation', 'Internship preparation', 'Field-specific learning', 'Language learning']
    },
    fieldSpecificDetails: { type: String }, // If "Field-specific learning" is selected

    // 4️⃣ Study Style
    preferredStudyStyle: {
        type: String,
        enum: ['Silent co-study', 'Discussion-based', 'Teaching/explaining', 'Problem-solving focused']
    },
    studyPacePreference: {
        type: String,
        enum: ['Slow & deep', 'Balanced', 'Fast & exam-oriented']
    },

    // 5️⃣ Logistics (Shared with Mentor)
    availability: {
        days: [{ type: String }],
        timeRanges: [{ type: String }]
    },
    studyMode: { type: String, enum: ['In-person', 'Online', 'Hybrid'] },
    preferredTools: [{ type: String }],

    // 6️⃣ Communication & Commitment (Student)
    communicationStyle: { type: String, enum: ['Direct', 'Friendly', 'Structured'] },
    commitmentLevel: { type: String, enum: ['Casual', 'Weekly sessions', 'Intensive (exam periods)'] },

    // 7️⃣ Language & Accessibility (Shared)
    languages: [{ type: String }],
    accessibilityPreferences: { type: String },

    // 8️⃣ Learning Compatibility (Student) - NEW
    learningTraits: [{ type: String }], // ['Fast-paced', 'Visual', 'Hands-on', etc.]

    // 9️⃣ Short Study Note
    studyNote: { type: String, maxlength: 200 },

    // Partner Matching
    lookingForPartner: { type: Boolean, default: false },

    // ===== COMMON FIELDS =====
    socialLinks: [{
        platform: { type: String, required: true }, // e.g., 'LinkedIn', 'GitHub', 'Portfolio'
        url: { type: String, required: true }
    }],
    skills: [{ type: String }],
    interests: [{ type: String }],

    // Mentorship Relationship Tracking
    enrolledMentees: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['active', 'completed'], default: 'active' },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date }
    }],
    enrolledMentors: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['active', 'completed'], default: 'active' },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date }
    }],
    enrolledPartners: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['active', 'completed'], default: 'active' },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date }
    }],

    // ===== MENTOR PROFILE FIELDS =====

    // 1️⃣ Identity & Academic Background
    currentField: { type: String }, // What mentor is currently working on
    universityGraduated: { type: String }, // University they graduated from

    // 2️⃣ Academic Standing & Credibility (Optional)
    classRank: { type: String, enum: ['Top 1', 'Top 2', 'Top 3'] },
    gpa: { type: Number },
    achievements: [{ type: String }], // Up to 5 items
    featuredAchievement: { type: String }, // One to show on card

    // 3️⃣ Mentorship Focus
    primaryMentorshipGoal: {
        type: String,
        enum: ['Academic guidance', 'Study strategy & planning', 'Interview preparation', 'Internship preparation', 'Field-specific guidance', 'Language learning support']
    },
    secondaryMentorshipGoal: {
        type: String,
        enum: ['Academic guidance', 'Study strategy & planning', 'Interview preparation', 'Internship preparation', 'Field-specific guidance', 'Language learning support']
    },
    fieldSpecificGuidanceDetails: { type: String }, // If "Field-specific guidance" is selected

    // 4️⃣ Mentorship Style
    mentorshipStyle: {
        type: String,
        enum: ['Structured (planned sessions)', 'Semi-structured', 'On-demand Q&A']
    },
    interactionType: { type: String, enum: ['One-on-one', 'Small group'] },


    // 5️⃣ Mentorship Approach & Match (NEW)
    mentoringApproach: { type: String }, // "How do you typically guide students?"
    preferredMenteeTraits: [{ type: String }], // ['Self-driven', 'Needs Structure', etc.]

    // 6️⃣ Commitment & Availability (uses shared availability field)
    sessionFrequency: { type: String, enum: ['On-demand', 'Weekly', 'Bi-weekly'] },
    maxMentees: { type: Number },

    // 7️⃣ Communication & Expectations (uses shared communicationStyle)
    expectedMenteeCommitment: { type: String, enum: ['Casual', 'Consistent', 'High commitment'] },

    // 8️⃣ Mentorship Mode & Tools
    mentorshipMode: { type: String, enum: ['In-person', 'Online', 'Hybrid'] },
    // uses shared preferredTools

    // 9️⃣ Mentor Statement
    mentorStatement: { type: String, maxlength: 200 },

    // Mentor Matching
    lookingForMentee: { type: Boolean, default: false },

    // Mentorship History (Track Record)
    mentorshipHistory: [{
        projectName: { type: String },
        menteeName: { type: String },
        menteeUsername: { type: String },
        pitchAnswers: { type: Map, of: mongoose.Schema.Types.Mixed },
        notes: { type: String },
        endDate: { type: Date }
    }],
    pitchQuestions: [{
        questionType: { type: String, enum: ['text', 'mcq', 'checkbox'], required: true },
        questionText: { type: String, required: true },
        options: [{ type: String }] // Only for mcq and checkbox
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
    planTemplate: { type: String }
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', userSchema);


