const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Notification = require('../models/Notification');

async function seedNotifications() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Get the first user (you can modify this to target a specific user)
        const user = await User.findOne();

        if (!user) {
            console.log('No users found. Please create a user first.');
            process.exit(1);
        }

        console.log(`Creating notifications for user: ${user.name} (${user.email})`);

        // Sample notifications
        const notifications = [
            {
                user: user._id,
                title: 'Welcome to Velto!',
                message: 'Thank you for joining our investment platform. Start exploring our investment plans.',
                type: 'success',
                read: false,
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
            },
            {
                user: user._id,
                title: 'Deposit Approved',
                message: 'Your deposit of $50 has been approved and credited to your account.',
                type: 'deposit',
                read: false,
                createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000) // 5 hours ago
            },
            {
                user: user._id,
                title: 'Investment Matured',
                message: 'Your Standard Plan investment has matured. Returns have been credited to your account.',
                type: 'success',
                read: true,
                createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
            },
            {
                user: user._id,
                title: 'Daily Payout Received',
                message: 'You received $5.00 as daily payout from your Premium Plan investment.',
                type: 'info',
                read: true,
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
            },
            {
                user: user._id,
                title: 'Withdrawal Pending',
                message: 'Your withdrawal request of $25.00 is being processed. Expected completion in 24 hours.',
                type: 'warning',
                read: false,
                createdAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
            },
            {
                user: user._id,
                title: 'Referral Bonus',
                message: 'You earned $5.00 referral bonus! Your friend just made their first investment.',
                type: 'success',
                read: false,
                createdAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
            },
            {
                user: user._id,
                title: 'New Investment Plan Available',
                message: 'Check out our new Platinum Plan with higher returns and exclusive benefits.',
                type: 'info',
                read: false,
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
            }
        ];

        // Delete existing notifications for this user (optional)
        await Notification.deleteMany({ user: user._id });
        console.log('Cleared existing notifications');

        // Insert new notifications
        await Notification.insertMany(notifications);
        console.log(`✅ Successfully created ${notifications.length} notifications`);

        process.exit(0);
    } catch (error) {
        console.error('Error seeding notifications:', error);
        process.exit(1);
    }
}

seedNotifications();
