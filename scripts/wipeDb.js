const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const wipe = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB...');

        const collections = await mongoose.connection.db.collections();

        for (let collection of collections) {
            await collection.deleteMany({});
            console.log(`Cleared collection: ${collection.collectionName}`);
        }

        console.log('✅ Database wiped successfully!');

        // Create test accounts
        console.log('\n📝 Creating test accounts...');

        const User = require('../models/User');
        const hashedPassword = await bcrypt.hash('a', 10);
        const hashedPasswordB = await bcrypt.hash('b', 10);
        const hashedPasswordC = await bcrypt.hash('c', 10);
        const hashedPasswordD = await bcrypt.hash('d', 10);

        // Account B - Mentor
        const mentorB = await User.create({
            name: 'Mentor B',
            username: 'b',
            email: 'b@gmail.com',
            password: hashedPasswordB,
            role: 'mentor',
            currentField: 'Computer Science',
            universityGraduated: 'MIT',
            mentorStatement: 'Experienced mentor passionate about helping students grow. Specialized in AI, ML, and career development.',
            lookingForMentee: true,
            pitchQuestions: [
                { questionType: 'text', questionText: 'What are your primary career goals for the next 2-3 years?' },
                { questionType: 'text', questionText: 'What specific challenges are you currently facing in your field?' },
                { questionType: 'text', questionText: 'How do you prefer to communicate and receive feedback?' }
            ],
            planTemplate: '# Mentorship Development Plan\n\n## Overview\nWelcome to our mentorship journey! This plan will be regularly updated to track your progress and set new goals.\n\n## Current Goals\n- [ ] Goal 1: Define specific objectives\n- [ ] Goal 2: Develop core skills\n- [ ] Goal 3: Build professional network\n\n## Milestones\n### Month 1\n- Initial assessment and goal setting\n\n### Month 2-3\n- Skill development and practice\n\n## Resources\n- Reading materials\n- Online courses\n- Networking opportunities',
            socialLinks: [
                { platform: 'LinkedIn', url: 'https://linkedin.com/in/mentorb' },
                { platform: 'GitHub', url: 'https://github.com/mentorb' }
            ]
        });

        // Account A - Student
        const studentA = await User.create({
            name: 'Student A',
            username: 'a',
            email: 'a@gmail.com',
            password: hashedPassword,
            role: 'student',
            major: 'Computer Science',
            university: 'Global Tech University',
            studyNote: 'Passionate software engineering student eager to learn and collaborate on exciting projects.',
            lookingForPartner: true,
            primaryStudyGoal: 'Concept mastery',
            preferredStudyStyle: 'Discussion-based',
            socialLinks: [
                { platform: 'GitHub', url: 'https://github.com/studenta' },
                { platform: 'LinkedIn', url: 'https://linkedin.com/in/studenta' }
            ]
        });

        // Account C - Student
        const studentC = await User.create({
            name: 'Student C',
            username: 'c',
            email: 'c@gmail.com',
            password: hashedPasswordC,
            role: 'student',
            major: 'Design',
            university: 'Creative Arts Academy',
            studyNote: 'Creative designer seeking collaboration on innovative projects. Love crafting beautiful user experiences.',
            lookingForPartner: true,
            primaryStudyGoal: 'Interview preparation',
            preferredStudyStyle: 'Problem-solving focused',
            socialLinks: [
                { platform: 'LinkedIn', url: 'https://linkedin.com/in/studentc' }
            ]
        });

        // Account D - Student
        const studentD = await User.create({
            name: 'Student D',
            username: 'd',
            email: 'd@gmail.com',
            password: hashedPasswordD,
            role: 'student',
            major: 'Statistics & Analytics',
            university: 'Data Insights Institute',
            studyNote: 'Data enthusiast exploring machine learning and statistical modeling. Always looking for new datasets to analyze!',
            lookingForPartner: true,
            primaryStudyGoal: 'Field-specific learning',
            preferredStudyStyle: 'Teaching/explaining',
            socialLinks: [
                { platform: 'GitHub', url: 'https://github.com/studentd' },
                { platform: 'LinkedIn', url: 'https://linkedin.com/in/studentd' }
            ]
        });

        console.log('✅ Created 4 test accounts:');
        console.log('   🧑‍🏫 Mentor: b / b@gmail.com (password: b)');
        console.log('   👨‍🎓 Student: a / a@gmail.com (password: a)');
        console.log('   👩‍🎓 Student: c / c@gmail.com (password: c)');
        console.log('   👨‍🎓 Student: d / d@gmail.com (password: d)');
        console.log('\n✨ All accounts are pre-configured and ready to use!');

        process.exit();
    } catch (error) {
        console.error('❌ Error wiping database:', error);
        process.exit(1);
    }
};

wipe();
