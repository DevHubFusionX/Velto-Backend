const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const connectDB = require('../config/db');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const resetAdmin = async () => {
    try {
        await connectDB();

        const adminEmail = 'admin@example.com';
        const newPassword = 'password123';

        let admin = await User.findOne({ email: adminEmail });

        if (admin) {
            admin.password = newPassword;
            await admin.save();
            console.log(`Admin password reset successfully.`);
            console.log(`Email: ${adminEmail}`);
            console.log(`New Password: ${newPassword}`);
        } else {
            console.log('Admin user not found. Creating new admin...');
            admin = await User.create({
                name: 'Admin User',
                email: adminEmail,
                password: newPassword,
                role: 'admin',
                location: 'System',
                phone: '+0000000000'
            });
            console.log(`Admin user created successfully.`);
            console.log(`Email: ${adminEmail}`);
            console.log(`Password: ${newPassword}`);
        }

        process.exit();
    } catch (err) {
        console.error('Error resetting admin password:', err);
        process.exit(1);
    }
};

resetAdmin();
