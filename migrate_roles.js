// One-time migration: copy old 'role' field into new 'roles' array
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const db = mongoose.connection.db;
    const usersCol = db.collection('users');

    // Find all users that have the old 'role' field but empty/missing 'roles'
    const usersToMigrate = await usersCol.find({
        role: { $exists: true }
    }).toArray();

    console.log('Total users with old role field:', usersToMigrate.length);

    let migrated = 0;
    for (const u of usersToMigrate) {
        const oldRole = u.role;
        const currentRoles = u.roles || [];

        // If roles array doesn't already contain the old role, add it
        if (oldRole && !currentRoles.includes(oldRole)) {
            await usersCol.updateOne(
                { _id: u._id },
                { $addToSet: { roles: oldRole } }
            );
            console.log(`  Migrated @${u.username}: added '${oldRole}' to roles`);
            migrated++;
        }
    }

    // Show final state of all admins
    const admins = await usersCol.find({
        $or: [{ role: 'admin' }, { roles: 'admin' }]
    }).project({ username: 1, role: 1, roles: 1 }).toArray();

    console.log('\nMigrated', migrated, 'users');
    console.log('Current admins:', JSON.stringify(admins, null, 2));

    mongoose.disconnect();
}).catch(e => {
    console.error(e);
    mongoose.disconnect();
});
