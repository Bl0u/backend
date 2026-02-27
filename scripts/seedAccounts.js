const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: '../.env' });

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
            name: 'Alice',
            email: 'a@example.com',
            username: 'a',
            password: hashedA,
            role: 'student',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
            major: 'Computer Science',
            academicLevel: 'Level 3',
            university: 'Cairo University',
            bio: 'I am a passionate CS student looking to collaborate on AI projects and deeply understand data structures.',
            partnerType: 'peer',
            matchingGoal: 'I want to build a deep learning model for computer vision.',
            topics: ['Machine Learning', 'Computer Vision', 'Python', 'Algorithms'],
            neededFromPartner: 'Someone with strong math background and Python skills to help with the algorithms.',
            timezone: 'UTC+2',
            languages: ['English', 'Arabic'],
            studyMode: 'Hybrid',
            preferredTools: ['Zoom', 'GitHub', 'VS Code', 'Discord'],
            availability: {
                days: ['Monday', 'Wednesday', 'Friday'],
                timeRanges: ['Evening (6PM - 10PM)']
            },
            commitmentLevel: 'Heavy',
            sessionsPerWeek: 3,
            sessionLength: '2 hours',
            pace: 'Balanced',
            canOffer: 'Strong programming skills in Python & React, and experience with UI/UX.',
            lookingForPartner: true,
            skills: ['Python', 'React', 'MongoDB', 'Node.js'],
            interests: ['AI', 'Open Source', 'Hackathons']
        };

        const baseProfileB = {
            name: 'Bob',
            email: 'b@example.com',
            username: 'b',
            password: hashedB,
            role: 'student',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
            major: 'Software Engineering',
            academicLevel: 'Level 4',
            university: 'Ain Shams University',
            bio: 'Focusing on distributed systems and cloud architecture. Looking for serious peers to study system design.',
            partnerType: 'project teammate',
            matchingGoal: 'Study System Design and prepare for FAANG interviews.',
            topics: ['System Design', 'Cloud Computing', 'AWS', 'Distributed Systems'],
            neededFromPartner: 'Someone who has experience with backend architecture and microservices.',
            timezone: 'UTC+3',
            languages: ['English'],
            studyMode: 'Online',
            preferredTools: ['Google Meet', 'Slack', 'Jira'],
            availability: {
                days: ['Saturday', 'Sunday'],
                timeRanges: ['Morning (8AM - 12PM)']
            },
            commitmentLevel: 'Balanced',
            sessionsPerWeek: 2,
            sessionLength: '3 hours',
            pace: 'Fast',
            canOffer: 'Deep knowledge of AWS, Docker, Kubernetes, and Golang.',
            lookingForPartner: true,
            skills: ['Golang', 'Docker', 'AWS', 'System Design'],
            interests: ['Cloud Tech', 'Backend Development', 'Competitive Programming']
        };

        const baseProfileC = {
            name: 'Charlie',
            email: 'c@example.com',
            username: 'c',
            password: hashedC,
            role: 'student',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
            major: 'Information Technology',
            academicLevel: 'Level 2',
            university: 'Alexandria University',
            bio: 'Interested in cybersecurity and ethical hacking. Let us secure the web together!',
            partnerType: 'peer',
            matchingGoal: 'Participate in CTF competitions and learn about web vulnerabilities.',
            topics: ['Cybersecurity', 'Ethical Hacking', 'Networking', 'Linux'],
            neededFromPartner: 'Must know basic Linux commands and network protocols.',
            timezone: 'UTC+2',
            languages: ['English', 'Arabic', 'French'],
            studyMode: 'In-person',
            preferredTools: ['Telegram', 'Discord'],
            availability: {
                days: ['Tuesday', 'Thursday'],
                timeRanges: ['Night (10PM - 2AM)']
            },
            commitmentLevel: 'Casual',
            sessionsPerWeek: 1,
            sessionLength: '1.5 hours',
            pace: 'Slow & deep',
            canOffer: 'Scripting in Bash and fundamental networking knowledge.',
            lookingForPartner: true,
            skills: ['Linux', 'Bash', 'Networking', 'Python'],
            interests: ['CTFs', 'Cybersecurity', 'Hardware']
        };

        const baseProfileD = {
            name: 'Diana',
            email: 'd@example.com',
            username: 'd',
            password: hashedD,
            role: 'student',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana',
            major: 'Data Science',
            academicLevel: 'Graduated',
            university: 'Helwan University',
            bio: 'Data enthusiast diving into big data analytics and statistical modeling. Seeking peers to review research papers.',
            partnerType: 'peer',
            matchingGoal: 'Review and discuss recent research papers in Data Science and LLMs.',
            topics: ['Data Science', 'Statistics', 'NLP', 'Big Data'],
            neededFromPartner: 'Strong mathematical foundation and ability to read academic papers critically.',
            timezone: 'UTC+2',
            languages: ['English', 'Arabic', 'German'],
            studyMode: 'Hybrid',
            preferredTools: ['Zoom', 'Webex', 'Notion'],
            availability: {
                days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                timeRanges: ['Afternoon (12PM - 4PM)']
            },
            commitmentLevel: 'Heavy',
            sessionsPerWeek: 4,
            sessionLength: '2 hours',
            pace: 'Balanced',
            canOffer: 'Expertise in R, Pandas, and advanced statistical analysis.',
            lookingForPartner: true,
            skills: ['R', 'Pandas', 'SQL', 'NLP', 'Statistics'],
            interests: ['Research', 'Machine Learning', 'Data Visualization']
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
