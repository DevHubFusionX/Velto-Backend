const mongoose = require('mongoose');
const dotenv = require('dotenv');
// Adjust paths based on execution from backend root
const User = require('../models/User');
const connectDB = require('../config/db');

dotenv.config();

const checkUsers = async () => {
    try {
        await connectDB();
        const users = await User.find({});
        console.log('\n--- USERS IN MONGODB ---');
        if (users.length === 0) {
            console.log('No users found in database.');
        } else {
            users.forEach(u => {
                console.log(`- Name: ${u.name}`);
                console.log(`  Email: ${u.email}`);
                console.log(`  ID: ${u._id}`);
                console.log('---');
            });
        }
        console.log(`Total Users: ${users.length}`);
        console.log('------------------------\n');
        process.exit();
    } catch (err) {
        console.error('Error querying database:', err);
        process.exit(1);
    }
};

checkUsers();
