const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const diagnose = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/grad-project');
        console.log('Connected to MongoDB');

        const totalUsers = await User.countDocuments();
        console.log(`Total users: ${totalUsers}`);

        const lookingForPartner = await User.find({ lookingForPartner: true });
        console.log(`Users looking for partner: ${lookingForPartner.length}`);

        if (lookingForPartner.length > 0) {
            console.log('Sample user looking for partner:');
            console.log({
                username: lookingForPartner[0].username,
                roles: lookingForPartner[0].roles,
                lookingForPartner: lookingForPartner[0].lookingForPartner
            });
        }

        const roleStudent = await User.find({ role: 'student' });
        console.log(`Users with role (singular): 'student': ${roleStudent.length}`);

        const rolesIncludeStudent = await User.find({ roles: 'student' });
        console.log(`Users with roles (plural) including 'student': ${rolesIncludeStudent.length}`);

        const both = await User.find({ roles: 'student', lookingForPartner: true });
        console.log(`Users with roles includes 'student' AND lookingForPartner: true: ${both.length}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

diagnose();
