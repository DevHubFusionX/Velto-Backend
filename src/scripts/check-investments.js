const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Investment = require('../models/Investment');
const UserInvestment = require('../models/UserInvestment');
const connectDB = require('../config/db');

dotenv.config();

const checkInvestments = async () => {
    try {
        await connectDB();
        const email = 'fanyanwu83@gmail.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User ${email} not found.`);
            process.exit();
        }

        console.log(`Checking investments for: ${user.name} (${user._id})`);

        const oldInvestments = await Investment.find({ user: user._id });
        console.log(`\n--- Old 'Investment' Collection ---`);
        console.log(`Count: ${oldInvestments.length}`);
        oldInvestments.forEach(inv => console.log(`- Amount: ${inv.amount}, Status: ${inv.status}`));

        const newInvestments = await UserInvestment.find({ user: user._id });
        console.log(`\n--- New 'UserInvestment' Collection ---`);
        console.log(`Count: ${newInvestments.length}`);
        newInvestments.forEach(inv => console.log(`- Amount: ${inv.amount}, Status: ${inv.status}`));

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkInvestments();
