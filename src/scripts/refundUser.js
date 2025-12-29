const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const refundUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const user = await User.findOne({ email: 'user@example.com' });
        if (!user) {
            console.log('User not found');
            process.exit(1);
        }

        console.log(`Current Balance: ${user.totalBalance}`);
        console.log(`Current Invested: ${user.totalInvested}`);
        
        // Refund 250,000
        user.totalBalance += 250000;
        user.totalInvested -= 250000;
        
        await user.save();
        
        console.log(`New Balance: ${user.totalBalance}`);
        console.log(`New Invested: ${user.totalInvested}`);
        console.log('Refund Successful');
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

refundUser();
