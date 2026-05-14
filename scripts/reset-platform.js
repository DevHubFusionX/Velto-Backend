/**
 * Platform Reset Script
 * - Deletes all users (except admin), and all user-related data
 * - Zeroes out all balances
 * - Preserves: InvestmentPlans, Settings, FeatureFlags, Products
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Delete all user accounts except admin
    const usersResult = await db.collection('users').deleteMany({ role: { $ne: 'admin' } });
    console.log(`🗑  Users deleted: ${usersResult.deletedCount}`);

    // Reset admin balances to zero
    const adminReset = await db.collection('users').updateMany(
        { role: 'admin' },
        { $set: { totalBalance: 0, totalInvested: 0, totalEarnings: 0, referralBalance: 0, lifetimeReferralEarnings: 0, referralCount: 0 } }
    );
    console.log(`🔄  Admin accounts zeroed: ${adminReset.modifiedCount}`);

    // Drop all user-related collections
    const toDrop = ['transactions', 'investments', 'userinvestments', 'kycs', 'notifications', 'payouts', 'auditlogs', 'cryptowallets', 'usercryptowallets'];
    for (const col of toDrop) {
        await db.collection(col).deleteMany({});
        console.log(`🗑  Cleared: ${col}`);
    }

    console.log('\n✅ Platform reset complete. Investment plans, settings, and feature flags preserved.');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('❌ Reset failed:', err.message);
    process.exit(1);
});
