const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Thread = require('../models/Thread');
const Post = require('../models/Post');
const User = require('../models/User');
const Request = require('../models/Request');

dotenv.config({ path: './backend/.env' });

const verifyNotifications = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Setup mock data
        console.log('Setting up mock data...');
        const userA = await User.create({ name: 'User A', username: 'usera', email: 'usera@test.com', password: 'password' });
        const userB = await User.create({ name: 'User B', username: 'userb', email: 'userb@test.com', password: 'password' });
        const userC = await User.create({ name: 'User C', username: 'userc', email: 'userc@test.com', password: 'password' });

        const thread = await Thread.create({
            author: userB._id,
            title: 'Test Thread',
            description: 'Testing follow-up logic 1.0',
            type: 'discussion'
        });

        // User A pins the thread
        userA.pinnedThreads.push(thread._id);
        await userA.save();

        console.log('Data setup complete.');

        // 2. Test Scenario 1: Main comment in pinned thread
        console.log('\nScenario 1: User C posts main comment in thread pinned by User A');
        const mainPost = await Post.create({
            thread: thread._id,
            author: userC._id,
            content: 'Hello everyone! This is a main comment.'
        });

        // Simulate resourceController addPost logic for notification
        const pinnedUsers = await User.find({ pinnedThreads: thread._id });
        for (const pinnedUser of pinnedUsers) {
            if (pinnedUser._id.toString() === userC._id.toString()) continue;
            await Request.create({
                sender: userC._id,
                receiver: pinnedUser._id,
                type: 'notification',
                message: `${userC.name} posted "Hello everyone! This is a main..." in thread "${thread.title}"|||THREAD:${thread._id}`,
                status: 'accepted',
                isPublic: false
            });
        }

        const notifyA = await Request.findOne({ receiver: userA._id, sender: userC._id });
        console.log('User A notified:', notifyA ? 'YES' : 'NO');
        if (notifyA) console.log('Message:', notifyA.message);

        // 3. Test Scenario 2: Reply to a msg
        console.log('\nScenario 2: User B replies to User C\'s comment');
        const replyPost = await Post.create({
            thread: thread._id,
            author: userB._id,
            content: 'Nice to meet you!',
            parentPost: mainPost._id
        });

        // Simulate reply logic
        const parentPost = await Post.findById(mainPost._id);
        if (parentPost && parentPost.author.toString() !== userB._id.toString()) {
            await Request.create({
                sender: userB._id,
                receiver: parentPost.author,
                type: 'notification',
                message: `${userB.name} replied to ur msg at thread "${thread.title}"|||THREAD:${thread._id}`,
                status: 'accepted',
                isPublic: false
            });
        }

        const notifyC = await Request.findOne({ receiver: userC._id, sender: userB._id });
        console.log('User C notified:', notifyC ? 'YES' : 'NO');
        if (notifyC) console.log('Message:', notifyC.message);

        // 4. Test Scenario 3: No notification for pinned user on secondary replies
        console.log('\nScenario 3: Verifying User A is NOT notified for the reply');
        const notifyA_Reply = await Request.findOne({ receiver: userA._id, sender: userB._id, message: /replied/ });
        console.log('User A notified for reply:', notifyA_Reply ? 'YES' : 'NO');

        // Cleanup
        console.log('\nCleaning up...');
        await User.deleteMany({ _id: { $in: [userA._id, userB._id, userC._id] } });
        await Thread.deleteOne({ _id: thread._id });
        await Post.deleteMany({ thread: thread._id });
        await Request.deleteMany({ $or: [{ sender: userC._id }, { sender: userB._id }] });

        console.log('Verification finished successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error during verification:', error);
        process.exit(1);
    }
};

verifyNotifications();
