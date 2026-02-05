const mongoose = require('mongoose');
const Plan = require('../models/Plan');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/graduationProject');

const cleanDefaultPlans = async () => {
    try {
        // Find and delete all plans with "Initial Mentorship Plan" title
        const result = await Plan.deleteMany({
            'versions.0.title': 'Initial Mentorship Plan'
        });

        console.log(`✅ Deleted ${result.deletedCount} default plans`);

        // Also delete any plans with welcome message in content
        const result2 = await Plan.deleteMany({
            'versions.0.content': { $regex: /Welcome.*personalized mentorship roadmap/i }
        });

        console.log(`✅ Deleted ${result2.deletedCount} plans with welcome message`);

        mongoose.connection.close();
        console.log('✅ Database cleanup complete');
    } catch (error) {
        console.error('❌ Error cleaning database:', error);
        mongoose.connection.close();
    }
};

cleanDefaultPlans();
