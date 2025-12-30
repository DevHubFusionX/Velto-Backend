const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const connectDB = require('../config/db');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const unlockAdmin = async () => {
    try {
        await connectDB();

        const adminEmail = 'admin@example.com';
        const admin = await User.findOne({ email: adminEmail });

        if (!admin) {
            console.log('Admin user not found.');
            process.exit(1);
        }

        console.log(`Checking Admin Status for ${adminEmail}:`);
        console.log(`- Login Attempts: ${admin.loginAttempts}`);
        console.log(`- Lock Until: ${admin.lockUntil}`);
        console.log(`- Suspended: ${admin.suspended}`);

        // Unlock
        admin.loginAttempts = 0;
        admin.lockUntil = undefined;
        admin.suspended = false; // Just in case
        await admin.save();

        console.log('-----------------------------------');
        console.log('Admin account has been unlocked.');
        console.log('Login Attempts reset to 0.');
        console.log('Lock removed.');

        process.exit();
    } catch (err) {
        console.error('Error unlocking admin:', err);
        process.exit(1);
    }
};

unlockAdmin();
