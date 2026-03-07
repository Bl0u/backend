/**
 * Create Admin Account Script
 * Run: node scripts/createAdmin.js
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        // Check if admin already exists
        const existing = await User.findOne({ username: 'admin' });
        if (existing) {
            console.log('Admin account already exists! Updating role to admin...');
            existing.role = 'admin';
            await existing.save();
            console.log('Done. Admin account:', existing.email);
            process.exit(0);
        }

        // Create new admin
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        const admin = await User.create({
            name: 'Admin',
            username: 'admin',
            email: 'admin@learncrew.com',
            password: hashedPassword,
            role: 'admin',
            stars: 99999
        });

        console.log('✅ Admin account created successfully!');
        console.log('   Email:    admin@learncrew.com');
        console.log('   Username: admin');
        console.log('   Password: admin123');
        console.log('   Stars:    99999');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

createAdmin();
