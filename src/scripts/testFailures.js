const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendNotification } = require('../utils/notification');

dotenv.config();

const testFailureNotifications = async (email) => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const user = await User.findOne({ email });
        if (!user) {
            console.error('User not found:', email);
            process.exit(1);
        }

        console.log(`Testing notifications for user: ${user.email}`);

        // 1. Simulate a Rejected Deposit (Admin rejection)
        const depositRef = `TEST-DEP-${Date.now()}`;
        const depTx = await Transaction.create({
            user: user._id,
            type: 'Deposit',
            amount: 5000,
            status: 'Pending',
            reference: depositRef,
            description: 'Test Deposit for Rejection'
        });

        console.log(`Created test deposit: ${depositRef}`);

        // Apply rejection logic (simulating admin controller)
        depTx.status = 'Rejected';
        depTx.description += ' - Rejected: Low quality proof';
        await depTx.save();

        await sendNotification(
            user._id,
            'Deposit Rejected',
            'Your deposit request has been rejected. Reason: Low quality proof',
            'warning'
        );
        console.log('Sent Deposit Rejected notification');

        // 2. Simulate a Failed Paystack Payment (Webhook failure)
        const failRef = `TEST-PAY-FAIL-${Date.now()}`;
        const payTx = await Transaction.create({
            user: user._id,
            type: 'Deposit',
            amount: 7000,
            status: 'Pending',
            reference: failRef,
            description: 'Test Paystack Deposit for Failure'
        });

        payTx.status = 'Failed';
        payTx.description += ' - Payment Failed on Gateway';
        await payTx.save();

        await sendNotification(
            user._id,
            'Payment Failed',
            `Your payment of 7000 NGN could not be processed by the gateway.`,
            'warning'
        );
        console.log('Sent Payment Failed notification');

        // Verify notifications in DB
        const latestNotifs = await Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(2);
        console.log('\nLatest Notifications in DB:');
        latestNotifs.forEach(n => console.log(`- ${n.title}: ${n.message} (${n.type})`));

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

const targetEmail = process.argv[2] || 'fanyanwu83@gmail.com';
testFailureNotifications(targetEmail);
