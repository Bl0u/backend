const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

// Models
const User = require('../models/User');
const Thread = require('../models/Thread');
const Post = require('../models/Post');
const Request = require('../models/Request');
const Plan = require('../models/Plan');
const Message = require('../models/Message');

// Import DB connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const importData = async () => {
    try {
        await connectDB();

        // Wipe Database completely
        console.log('Wiping database...');
        await User.deleteMany();
        await Thread.deleteMany();
        await Post.deleteMany();
        await Request.deleteMany();
        await Plan.deleteMany();
        await Message.deleteMany();
        console.log('Database wiped successfully.');

        // Hash passwords
        const salt = await bcrypt.genSalt(10);
        const hashedA = await bcrypt.hash('a', salt);
        const hashedB = await bcrypt.hash('b', salt);
        const hashedC = await bcrypt.hash('c', salt);
        const hashedD = await bcrypt.hash('d', salt);

        // Define Base Full Profile Information
        const baseProfileA = {
            name: 'Alice Johnson',
            email: 'a@example.com',
            username: 'a',
            password: hashedA,
            role: 'student',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
            major: 'Computer Science',
            academicLevel: 'Level 3',
            university: 'Cairo University',
            bio: 'CS student passionate about AI and algorithms.',
            lookingForPartner: true,
            stars: 100
        };

        const baseProfileB = {
            name: 'Bob Smith',
            email: 'b@example.com',
            username: 'b',
            password: hashedB,
            role: 'student',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
            major: 'Software Engineering',
            academicLevel: 'Level 4',
            university: 'Ain Shams University',
            bio: 'Focusing on backend systems and cloud.',
            lookingForPartner: true,
            stars: 150
        };

        const baseProfileC = {
            name: 'Charlie Brown',
            email: 'c@example.com',
            username: 'c',
            password: hashedC,
            role: 'student',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
            major: 'Information Technology',
            academicLevel: 'Level 2',
            university: 'Alexandria University',
            bio: 'Cybersecurity enthusiast.',
            lookingForPartner: true,
            stars: 200
        };

        const baseProfileD = {
            name: 'Diana Prince',
            email: 'd@example.com',
            username: 'd',
            password: hashedD,
            role: 'student',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana',
            major: 'Data Science',
            academicLevel: 'Graduated',
            university: 'Helwan University',
            bio: 'Data analyst and stat nerd.',
            lookingForPartner: true,
            stars: 300
        };

        const users = await User.insertMany([baseProfileA, baseProfileB, baseProfileC, baseProfileD]);
        console.log(`Successfully created ${users.length} full-profile test accounts!`);
        console.log('Usernames: a, b, c, d (Passwords are identical to usernames)');

        process.exit(0);
    } catch (error) {
        console.error(`Error with seeding: ${error.message}`);
        process.exit(1);
    }
};

importData();
