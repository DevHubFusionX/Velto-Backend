const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// 1. Manually mock dependencies BEFORE requiring notification utility
const socketMock = {
    emitToUser: (userId, event, data) => console.log(`[Socket] To User ${userId}: ${event}`, data),
    getIo: () => ({
        to: (room) => ({
            emit: (event, data) => console.log(`[Socket] To Room ${room}: ${event}`, data)
        })
    })
};

// We intercept the require for socket
require.cache[require.resolve('../socket')] = {
    id: require.resolve('../socket'),
    filename: require.resolve('../socket'),
    loaded: true,
    exports: socketMock
};

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendNotification, sendAdminNotification } = require('../utils/notification');

async function testNotificationUpgrade() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB for testing...');

        const testUser = await User.findOne({ email: 'test@example.com' }) || 
                         await User.findOne();
        
        if (!testUser) {
            console.error('No users found in database.');
            process.exit(1);
        }

        console.log(`Testing with user: ${testUser.email} (${testUser._id})`);

        // 1. User Deposit Trigger
        console.log('\n--- Scenario 1: User Deposit ---');
        await sendNotification(
            testUser._id,
            'Deposit Initiated',
            'Your deposit of 5000 NGN is pending.',
            'deposit',
            'normal',
            { transactionId: 'test_tx_123' }
        );

        await sendAdminNotification(
            'New Deposit Alert',
            `User ${testUser.email} deposited 5000 NGN.`,
            'admin',
            'normal',
            { userId: testUser._id, transactionId: 'test_tx_123' }
        );

        // 2. High-Value Investment Trigger
        console.log('\n--- Scenario 2: High-Value Investment ---');
        await sendAdminNotification(
            '🔥 High-Value Investment Alert',
            `User ${testUser.email} invested $50,000!`,
            'admin',
            'high',
            { userId: testUser._id, amount: 50000 }
        );

        // 3. Verify DB Records
        console.log('\n--- Verifying Database Records ---');
        const latest = await Notification.find().sort({ createdAt: -1 }).limit(3);
        latest.forEach(n => {
            console.log(`- [${n.role}] ${n.priority.toUpperCase()} | ${n.title}: ${n.message}`);
        });

        console.log('\nVerification Complete!');
        process.exit(0);
    } catch (err) {
        console.error('Test Failed:', err);
        process.exit(1);
    }
}

testNotificationUpgrade();
