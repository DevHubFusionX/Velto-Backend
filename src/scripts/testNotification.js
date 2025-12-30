const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendNotification } = require('../utils/notification');

dotenv.config();

const testNotifications = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const user = await User.findOne();
        if (!user) {
            console.error('No user found to test with');
            process.exit(1);
        }

        console.log(`Testing with user: ${user.email} (${user._id})`);

        const testNotification = await sendNotification(
            user._id,
            'Test Deposit Success',
            'This is a test notification for a successful deposit to verify email delivery.',
            'success',
            'high'
        );

        if (testNotification) {
            console.log('Notification created successfully:', testNotification._id);

            // Verify it exists in DB
            const found = await Notification.findById(testNotification._id);
            if (found) {
                console.log('Verified notification exists in database.');
            } else {
                console.error('Failed to verify notification in database.');
            }
        } else {
            console.error('Failed to create notification.');
        }

        await mongoose.connection.close();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error during verification:', error);
        process.exit(1);
    }
};

testNotifications();
