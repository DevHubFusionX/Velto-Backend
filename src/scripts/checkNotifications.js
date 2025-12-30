const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Notification = require('../models/Notification');
const User = require('../models/User');

dotenv.config();

const checkNotifications = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const totalNotifications = await Notification.countDocuments();
        console.log(`Total notifications in system: ${totalNotifications}`);

        const latestNotifications = await Notification.find()
            .populate('user', 'email name')
            .sort({ createdAt: -1 })
            .limit(10);

        console.log('\n--- Latest 10 Notifications ---');
        latestNotifications.forEach(n => {
            console.log(`[${n.createdAt}] To: ${n.user ? n.user.email : 'NULL'} | Title: ${n.title} | Type: ${n.type}`);
        });

        const users = await User.find({}, 'email name');
        console.log('\n--- User List ---');
        users.forEach(u => {
            console.log(`ID: ${u._id} | Email: ${u.email}`);
        });

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkNotifications();
