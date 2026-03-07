const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const Thread = require('../models/Thread');

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('Connected to DB');
        const tags = await Thread.distinct('tags');
        console.log('Unique tags in DB:', tags);

        try {
            const id = mongoose.Types.ObjectId('645fcbf6e48c1e2b489a2345');
            console.log('ObjectId works without new:', id);
        } catch (e) {
            console.log('Error without new:', e.message);
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
