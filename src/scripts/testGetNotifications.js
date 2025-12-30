const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Notification = require('../models/Notification');
const User = require('../models/User');

dotenv.config();

const testGetNotifications = async (email) => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const user = await User.findOne({ email });
        if (!user) {
            console.error('User not found:', email);
            process.exit(1);
        }

        console.log(`Testing getNotifications for: ${user.email} (ID: ${user._id})`);

        // Simulate req.user.id which is used in the controller
        const userIdString = user._id.toString();
        
        // 1. Test using ID string (what the controller does: find({ user: req.user.id }))
        const notifsByIdString = await Notification.find({ user: userIdString });
        console.log(`Found with ID string: ${notifsByIdString.length}`);

        // 2. Test using ObjectId (safer)
        const notifsByObjectId = await Notification.find({ user: user._id });
        console.log(`Found with ObjectId: ${notifsByObjectId.length}`);

        if (notifsByObjectId.length > 0) {
            console.log('Sample notification:', notifsByObjectId[0]);
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

const targetEmail = process.argv[2] || 'fanyanwu83@gmail.com';
testGetNotifications(targetEmail);
