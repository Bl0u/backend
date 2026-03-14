const mongoose = require('mongoose');

const questionSchema = mongoose.Schema({
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'radio', 'checkbox'], default: 'text' },
    required: { type: Boolean, default: false },
    categoryId: { type: String, required: true },
    options: [{ type: String }] // For radio and checkbox
});

const categorySchema = mongoose.Schema({
    id: { type: String, required: true },
    label: { type: String, required: true }
});

const pitchConfigSchema = mongoose.Schema({
    categories: [categorySchema],
    questions: [questionSchema],
    rolesEnabled: { type: Boolean, default: false }
}, {
    timestamps: true
});

module.exports = mongoose.model('PitchConfig', pitchConfigSchema);
