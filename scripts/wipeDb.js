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
        const Thread = require('../models/Thread');
        const hashedPassword = await bcrypt.hash('a', 10);
        const hashedPasswordB = await bcrypt.hash('b', 10);
        const hashedPasswordC = await bcrypt.hash('c', 10);
        const hashedPasswordD = await bcrypt.hash('d', 10);

        // Account B - Mentor (Mentor B)
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

        // Account A - Student (Student A)
        const studentA = await User.create({
            name: 'Student A',
            username: 'a',
            email: 'a@gmail.com',
            password: hashedPassword,
            role: 'student',
            major: 'Computer Science',
            university: 'Sinai University',
            studyNote: 'Passionate software engineering student eager to learn and collaborate on exciting projects.',
            lookingForPartner: true,
            primaryStudyGoal: 'Concept mastery',
            preferredStudyStyle: 'Discussion-based'
        });

        // Threads for Student A
        await Thread.create([
            {
                author: studentA._id,
                title: 'Memory Management 101: Paging vs. Segmentation',
                description: 'Deep dive into virtual memory for 3rd-year Engineering students.',
                type: 'college',
                tags: ['#OperatingSystems', '#SinaiUniversity', '#MemoryManagement', '#OS_Kernel', '#ComputerScience'],
                isPaid: false
            },
            {
                author: studentA._id,
                title: 'Competitive Programming: From Zero to LeetCode Medium',
                description: 'Essential patterns for technical interviews and coding contests.',
                type: 'college',
                tags: ['#DSA', '#Algorithms', '#ProgrammingRoadmap', '#CompetitiveProgramming', '#SinaiUniversity'],
                isPaid: false
            }
        ]);

        // Account C - Student (Student C)
        const studentC = await User.create({
            name: 'Student C',
            username: 'c',
            email: 'c@gmail.com',
            password: hashedPasswordC,
            role: 'student',
            major: 'Computer Science',
            university: 'Cairo University',
            studyNote: 'Intern at Google | Seeking System Architect position. Creative designer seeking collaboration on innovative projects.',
            lookingForPartner: true,
            stars: 500
        });

        // Threads for Student C
        await Thread.create([
            {
                author: studentC._id,
                title: 'System Design Frameworks for Scale: The Architect’s Blueprint',
                description: 'Exclusive insights into how to handle 100k+ TPS, database sharding, and global consistency models. Focused on Google/Meta/Amazon technical standards.',
                type: 'interview',
                tags: ['#SystemDesign', '#Scalability', '#GoogleInterview', '#SoftwareArchitecture', '#CloudComputing', '#PaidContent'],
                isPaid: true,
                price: 50
            },
            {
                author: studentC._id,
                title: 'Solving Complex Navier-Stokes Applications in Aero-Dynamics',
                description: 'High-level derivation of fluid flow equations for mechanical and civil engineering projects.',
                type: 'college',
                tags: ['#FluidMechanics', '#Aerodynamics', '#EngineeringMath', '#MechanicalEngineering', '#Physics', '#CairoUniversity'],
                isPaid: true,
                price: 30
            }
        ]);

        // Account Peter - New Student
        const peter = await User.create({
            name: 'Peter Chen',
            username: 'peter',
            email: 'peter@gmail.com',
            password: hashedPassword, // 'a'
            role: 'student',
            major: 'Computer Science & AI',
            university: 'Cairo University',
            studyNote: 'Junior student specializing in AI and distributed systems. Active contributor to open-source OS projects.',
            lookingForPartner: true
        });

        // Account D - Student
        const studentD = await User.create({
            name: 'Student D',
            username: 'd',
            email: 'd@gmail.com',
            password: hashedPasswordD,
            role: 'student',
            major: 'Statistics & Analytics',
            university: 'Data Insights Institute'
        });

        console.log('✅ Created pitch-ready accounts and threads:');
        console.log('   👨‍🎓 Student Peter: peter / a (Cairo University)');
        console.log('   👨‍🎓 Student A: a / a (Sinai University) - 2 Free Threads');
        console.log('   👩‍🎓 Student C: c / c (Cairo University) - 2 Paid Threads (Google Context)');
        console.log('   🧑‍🏫 Mentor B: b / b');
        console.log('\n✨ All accounts are pre-configured and ready to use!');

        process.exit();
    } catch (error) {
        console.error('❌ Error wiping database:', error);
        process.exit(1);
    }
};

wipe();
