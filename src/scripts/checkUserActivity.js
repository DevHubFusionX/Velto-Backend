const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const User = require('../models/User');

dotenv.config();

const checkUserActivity = async (email) => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const user = await User.findOne({ email });
        if (!user) {
            console.error('User not found:', email);
            process.exit(1);
        }

        console.log(`Checking activity for: ${user.email} (ID: ${user._id})`);

        const transactions = await Transaction.find({ user: user._id }).sort({ date: -1 });
        console.log(`Total transactions for user: ${transactions.length}`);
        transactions.forEach(tx => {
            console.log(`[${tx.date}] Type: ${tx.type} | Status: ${tx.status} | Amount: ${tx.amount}`);
        });

        const notifications = await Notification.find({ user: user._id }).sort({ createdAt: -1 });
        console.log(`Total notifications for user: ${notifications.length}`);
        notifications.forEach(n => {
            console.log(`[${n.createdAt}] Title: ${n.title} | Type: ${n.type}`);
        });

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

const targetEmail = process.argv[2] || 'user@example.com';
checkUserActivity(targetEmail);
