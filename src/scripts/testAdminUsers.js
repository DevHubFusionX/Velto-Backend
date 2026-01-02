const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const UserInvestment = require('../models/UserInvestment');
const InvestmentPlan = require('../models/InvestmentPlan');
const adminUserController = require('../controllers/admin/admin.user.controller');

dotenv.config();

const runTest = async () => {
    try {
        console.log('--- STARTING ADMIN USER TEST ---');

        // Connect to DB
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is missing in env');
        }
        await mongoose.connect(process.env.MONGO_URI);

        // 1. Create Test User
        const testEmail = `admin_test_${Date.now()}@example.com`;
        const user = await User.create({
            name: 'Admin Test User',
            email: testEmail,
            password: 'password123',
            referralCode: `REF_ADMIN_${Date.now()}`,
            totalBalance: 2500
        });

        // 2. Create Test Plan
        const plan = await InvestmentPlan.create({
            name: 'Admin View Plan',
            minAmount: 100,
            maxAmount: 10000,
            dailyPayout: 5,
            isPercentage: true,
            durationDays: 30
        });

        // 3. Create Active Investment
        const investment = await UserInvestment.create({
            user: user._id,
            plan: plan._id,
            amount: 1000,
            dailyPayoutAmount: 50,
            totalPayoutReceived: 0,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            nextPayoutDate: new Date(),
            status: 'active'
        });

        console.log(`Created User ${user._id} with Investment of 1000`);

        // 4. Mock Request/Response
        const req = {};
        const res = {
            json: (data) => {
                const targetUser = data.find(u => u.email === testEmail);
                if (targetUser) {
                    console.log('--- FOUND USER IN RESPONSE ---');
                    console.log(`Name: ${targetUser.name}`);
                    console.log(`Balance: ${targetUser.totalBalance} (Expected: 2500)`);
                    console.log(`Total Invested Calculated: ${targetUser.totalInvestedCalculated} (Expected: 1000)`);
                    console.log(`Active Holdings: ${targetUser.activeHoldings} (Expected: 1000)`);

                    if (targetUser.totalInvestedCalculated === 1000 && targetUser.activeHoldings === 1000) {
                        console.log('✅ Admin API returns correct aggregated investment data.');
                    } else {
                        console.error('❌ Data mismatch in Admin API.');
                    }
                } else {
                    console.error('❌ Created user not found in Admin API response.');
                }
            },
            status: (code) => ({ json: (err) => console.error('Error Status:', code, err) })
        };

        // 5. Call Controller
        await adminUserController.getUsers(req, res);

        // Cleanup
        await User.deleteOne({ _id: user._id });
        await UserInvestment.deleteOne({ _id: investment._id });
        await InvestmentPlan.deleteOne({ _id: plan._id });
        console.log('\nCleaned up test data.');

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        await mongoose.disconnect();
    }
};

runTest();
