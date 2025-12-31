/**
 * Utility script to clear all non-admin users and their associated data
 * Run with: node src/scripts/clearUsers.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');
const UserInvestment = require('../models/UserInvestment');
const KYC = require('../models/KYC');
const Notification = require('../models/Notification');
const Payout = require('../models/Payout');
const UserCryptoWallet = require('../models/UserCryptoWallet');
const AuditLog = require('../models/AuditLog');

const clearUsers = async () => {
    try {
        await connectDB();
        console.log('\n🔗 Connected to MongoDB');

        // Identify non-admin users
        // We preserve roles 'admin' and 'Superuser' as they are required for dashboard access
        const nonAdminQuery = { role: { $nin: ['admin', 'Superuser'] } };
        const nonAdmins = await User.find(nonAdminQuery);
        const nonAdminIds = nonAdmins.map(user => user._id);

        console.log(`\n🔍 Found ${nonAdminIds.length} non-admin users to clear.`);

        if (nonAdminIds.length === 0) {
            console.log('✨ No non-admin users found. Database is already clean.');
            process.exit(0);
        }

        console.log('\n🧹 Clearing associated user data...');

        const cleanupTasks = [
            { name: 'Transactions', model: Transaction },
            { name: 'User Investments', model: UserInvestment },
            { name: 'KYC Records', model: KYC },
            { name: 'Notifications', model: Notification },
            { name: 'Payouts', model: Payout },
            { name: 'User Crypto Wallets', model: UserCryptoWallet },
            { name: 'Audit Logs', model: AuditLog }
        ];

        for (const task of cleanupTasks) {
            const result = await task.model.deleteMany({ user: { $in: nonAdminIds } });
            console.log(`  ✅ Removed ${result.deletedCount} ${task.name}`);
        }

        // Finally, delete the users
        console.log('\n👤 Deleting user accounts...');
        const userResult = await User.deleteMany({ _id: { $in: nonAdminIds } });
        console.log(`  ✅ Successfully deleted ${userResult.deletedCount} user accounts.`);

        console.log('\n🎉 Database cleanup complete. Admins and platform settings preserved.\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Cleanup failed:', error);
        process.exit(1);
    }
};

clearUsers();
