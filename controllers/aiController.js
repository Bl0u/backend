const { GoogleGenerativeAI } = require('@google/generative-ai');
const Thread = require('../models/Thread');
const mongoose = require('mongoose');

// @desc    Interpret user query and recommend threads
// @route   POST /api/ai/recommend
// @access  Private (or Public depending on preference, making it Private for now)
const interpretAndRecommend = async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ message: 'Prompt is required' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ message: 'AI Service currently unavailable (Missing API Key)' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const systemInstructions = `
            You are an academic assistant for "El-Zatona" (LearnCrew), a student resource hub.
            Your task is to interpret the user's request and extract specific academic filters.
            
            Return ONLY a JSON object with these keys:
            - "university": Extracted university name (e.g. "Cairo University").
            - "subject": Extracted subject (e.g. "DSA").
            - "professor": Extracted professor name.
            - "company": Extracted company (for interviews).
            - "explanation": A friendly, short 1-sentence response to the user.
            
            Formatting rules for extraction:
            - For University, Subject, Professor, and Company, use clean title case.
            - If a value is missing, return an empty string.
            
            Example Input: "im at cairo university, i got a pattern recongition exam next week, can u gimme threads related to this?"
            Example Output: {
                "university": "Cairo University",
                "subject": "Pattern Recognition",
                "professor": "",
                "company": "",
                "explanation": "I've scanned our intelligence for Pattern Recognition resources at Cairo University."
            }
        `;

        const result = await model.generateContent([systemInstructions, prompt]);
        const response = await result.response;
        let text = response.text();

        // Clean JSON if Gemini adds markdown blocks
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const interpretedData = JSON.parse(text);

        // Build the query based on extracted tags
        let query = {};
        let tagsToSearch = [];

        if (interpretedData.university) {
            tagsToSearch.push(`#${interpretedData.university.replace(/\s+/g, '')}`);
        }
        if (interpretedData.professor) {
            tagsToSearch.push(`#Prof${interpretedData.professor.replace(/\s+/g, '')}`);
        }
        if (interpretedData.subject) {
            tagsToSearch.push(`#Subj${interpretedData.subject.replace(/\s+/g, '')}`);
        }
        if (interpretedData.company) {
            tagsToSearch.push(`#Comp${interpretedData.company.replace(/\s+/g, '')}`);
        }

        if (tagsToSearch.length > 0) {
            // Match threads that have ANY of these tags
            query.tags = { $in: tagsToSearch };
        }

        // Fetch threads (limiting to top 5 for chat)
        const threads = await Thread.find(query)
            .populate('author', 'name username avatar')
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            explanation: interpretedData.explanation,
            filters: interpretedData,
            threads: threads
        });

    } catch (error) {
        console.error('AI Recommendation Error:', error);
        res.status(500).json({ message: 'AI interpretation failed', error: error.message });
    }
};

module.exports = {
    interpretAndRecommend
};
