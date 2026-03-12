const mongoose = require('mongoose');

const questionSchema = mongoose.Schema({
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'radio', 'checkbox'], default: 'text' },
    required: { type: Boolean, default: false },
    options: [{ type: String }] // For radio and checkbox
});

const groupConfigSchema = mongoose.Schema({
    groupType: { type: String, required: true, unique: true }, // e.g., 'University', 'School', 'Institution'
    metadataRequirements: {
        requireUniversity: { type: Boolean, default: false },
        requireCollege: { type: Boolean, default: false },
        requireLevel: { type: Boolean, default: false }, // Level 1, 2, 3, 4
        requireGrade: { type: Boolean, default: false }, // Grade 1, 2...
        requireInstitution: { type: Boolean, default: false }
    },
    questions: [questionSchema]
}, {
    timestamps: true
});

module.exports = mongoose.model('GroupConfig', groupConfigSchema);
