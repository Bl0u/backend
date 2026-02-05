const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected for seeding...');

        const adminExists = await User.findOne({ email: 'admin@university.edu' });
        if (adminExists) {
            console.log('Admin user already exists');
            process.exit();
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('AdminPassword123!', salt);

        await User.create({
            name: 'University Admin',
            username: 'admin',
            email: 'admin@university.edu',
            password: hashedPassword,
            role: 'admin'
        });

        console.log('Admin account seeded successfully: admin@university.edu / AdminPassword123!');
        process.exit();
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
