const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const UserInvestment = require('../models/UserInvestment');
const InvestmentPlan = require('../models/InvestmentPlan');
const Transaction = require('../models/Transaction');
const Payout = require('../models/Payout');
const { processPayouts } = require('../services/payout.scheduler');

dotenv.config();

const runTest = async () => {
    try {
        console.log('--- STARTING PAYOUT TEST (Total Returns) ---');

        // Connect to DB
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is missing in env');
        }
        await mongoose.connect(process.env.MONGO_URI);

        // 1. Create Test User
        const testEmail = `test_returns_${Date.now()}@example.com`;
        const user = await User.create({
            name: 'Test Returns User',
            email: testEmail,
            password: 'password123',
            referralCode: `REF_RET_${Date.now()}`,
            totalBalance: 1000,
            totalReturns: 0 // Start at 0
        });
        console.log(`Created User: ${user.email} (Returns: ${user.totalReturns})`);

        // 2. Create Test Plan
        const plan = await InvestmentPlan.create({
            name: 'Test Tech Plan',
            minAmount: 100,
            maxAmount: 10000,
            dailyPayout: 5,
            isPercentage: true,
            durationDays: 10
        });

        // 3. Create Test Investment (Due for payout)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const investmentAmount = 1000;
        const dailyPayoutAmount = 50;

        const investment = await UserInvestment.create({
            user: user._id,
            plan: plan._id,
            amount: investmentAmount,
            dailyPayoutAmount: 50,
            startDate: new Date(),
            endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            nextPayoutDate: yesterday,
            status: 'active'
        });

        // 4. Run Scheduler
        console.log('>>> Running processPayouts()...');
        await processPayouts();
        console.log('>>> processPayouts() finished.');

        // 5. Build Verification
        const updatedUser = await User.findById(user._id);

        console.log('\n--- VERIFICATION RESULTS ---');

        // Check User Total Returns
        if (updatedUser.totalReturns === 50) {
            console.log(`✅ User Total Returns Updated Correctly: ${updatedUser.totalReturns}`);
        } else {
            console.error(`❌ User Total Returns Incorrect. Expected 50, got ${updatedUser.totalReturns}`);
        }

        // Check Balance too
        if (updatedUser.totalBalance === 1050) {
            console.log(`✅ User Balance Updated Correctly: ${updatedUser.totalBalance}`);
        } else {
            console.error(`❌ User Balance Incorrect. Expected 1050, got ${updatedUser.totalBalance}`);
        }

        // Cleanup
        await User.deleteOne({ _id: user._id });
        await UserInvestment.deleteOne({ _id: investment._id });
        await InvestmentPlan.deleteOne({ _id: plan._id });
        await Transaction.deleteMany({ user: user._id });
        await Payout.deleteMany({ user: user._id });
        console.log('\nCleaned up test data.');

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        await mongoose.disconnect();
    }
};

runTest();
