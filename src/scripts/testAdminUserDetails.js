const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const UserInvestment = require('../models/UserInvestment');
const adminUserController = require('../controllers/admin/admin.user.controller');

dotenv.config();

const runTest = async () => {
    try {
        console.log('--- STARTING ADMIN USER DETAILS TEST ---');

        // Connect to DB
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is missing in env');
        }
        await mongoose.connect(process.env.MONGO_URI);

        // 1. Create Test User
        const testEmail = `admin_detail_${Date.now()}@example.com`;
        const user = await User.create({
            name: 'Admin Detail Test',
            email: testEmail,
            password: 'password123',
            referralCode: `REF_DET_${Date.now()}`,
            totalBalance: 5000
        });

        const InvestmentPlan = require('../models/InvestmentPlan');

        // 1b. Create Test Plan (Required by UserInvestment model)
        const plan = await InvestmentPlan.create({
            name: `Dummy Plan ${Date.now()}`,
            minAmount: 100,
            maxAmount: 10000,
            dailyPayout: 1,
            isPercentage: true,
            durationDays: 10
        });

        // 2. Create Active Investment
        // Note: Using minimal fields as we only test aggregation
        const investment1 = await UserInvestment.create({
            user: user._id,
            plan: plan._id,
            amount: 2000,
            status: 'active',
            startDate: new Date(),
            endDate: new Date(),
            dailyPayoutAmount: 0 // required field usually
        });

        const investment2 = await UserInvestment.create({
            user: user._id,
            plan: plan._id,
            amount: 500,
            status: 'completed',
            startDate: new Date(),
            endDate: new Date(),
            dailyPayoutAmount: 0
        });

        console.log(`Created User ${user._id} with Investments: 2000 (Active) + 500 (Completed)`);

        // 3. Mock Request/Response
        const req = { params: { userId: user._id } };
        const res = {
            json: (data) => {
                console.log('--- CONTROLLER RESPONSE ---');
                console.log(`Total Invested Value: ${data.totalInvestedValue} (Expected: 2500)`);
                console.log(`Active Invested Value: ${data.activeInvestedValue} (Expected: 2000)`);
                console.log(`Total Investments Count: ${data.totalInvestmentsCount} (Expected: 2)`);
                console.log(`Active Investments Count: ${data.activeInvestmentsCount} (Expected: 1)`);

                if (data.totalInvestedValue === 2500 && data.activeInvestedValue === 2000) {
                    console.log('✅ Admin Details API returns correct values.');
                } else {
                    console.error('❌ Data mismatch in Admin Details API.');
                }
            },
            status: (code) => {
                return {
                    json: (err) => console.error('Error Status:', code, err)
                };
            }
        };

        // 4. Call Controller
        await adminUserController.getUserDetails(req, res);

        // Cleanup
        await User.deleteOne({ _id: user._id });
        await UserInvestment.deleteMany({ user: user._id });
        console.log('\nCleaned up test data.');

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        await mongoose.disconnect();
    }
};

runTest();
