/**
 * End-to-end referral flow test
 * Tests: register referrer → register referee → invest → referral bonus created → scheduler unlocks it
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const Investment = require('../src/models/Investment');
const UserInvestment = require('../src/models/UserInvestment');
const InvestmentPlan = require('../src/models/InvestmentPlan');
const Settings = require('../src/models/Settings');

const { processReferralRewards } = require('../src/services/payout.scheduler');

const log = (label, data) => console.log(`\n[${label}]`, JSON.stringify(data, null, 2));
const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => console.log(`  ❌ FAIL: ${msg}`);
const section = (msg) => console.log(`\n${'─'.repeat(50)}\n▶ ${msg}\n${'─'.repeat(50)}`);

async function cleanup(emails) {
    const users = await User.find({ email: { $in: emails } });
    const ids = users.map(u => u._id);
    await User.deleteMany({ _id: { $in: ids } });
    await UserInvestment.deleteMany({ user: { $in: ids } });
    await Investment.deleteMany({ user: { $in: ids } });
    await Transaction.deleteMany({ user: { $in: ids } });
    console.log('\n🧹 Cleanup done');
}

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const REFERRER_EMAIL = 'test-referrer@velto.com';
    const REFEREE_EMAIL  = 'test-referee@velto.com';

    // Clean up any previous test data
    await cleanup([REFERRER_EMAIL, REFEREE_EMAIL]);

    // ── STEP 1: Get or create an active investment plan ──────────────────────
    section('STEP 1: Ensure active investment plan exists');
    let plan = await InvestmentPlan.findOne({ status: 'active' });
    if (!plan) {
        plan = await InvestmentPlan.create({
            name: 'Test Plan',
            minAmount: 100,
            maxAmount: 100000,
            dailyPayout: 1.5,
            isPercentage: true,
            durationDays: 30,
            status: 'active'
        });
        pass(`Created plan: ${plan.name}`);
    } else {
        pass(`Using existing plan: ${plan.name} (min: $${plan.minAmount})`);
    }

    // ── STEP 2: Register referrer ─────────────────────────────────────────────
    section('STEP 2: Create referrer');
    const referrer = await User.create({
        name: 'Test Referrer',
        email: REFERRER_EMAIL,
        password: 'Test@1234',
        referralCode: 'TESTREF01',
        isEmailVerified: true,
        totalBalance: 5000
    });
    pass(`Referrer created: ${referrer.email} | code: ${referrer.referralCode}`);

    // ── STEP 3: Referrer must have an active investment (required by logic) ───
    section('STEP 3: Give referrer an active investment');
    await UserInvestment.create({
        user: referrer._id,
        plan: plan._id,
        amount: 500,
        dailyPayoutAmount: 7.5,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        nextPayoutDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active'
    });
    pass('Referrer has active investment');

    // ── STEP 4: Register referee with referral code ───────────────────────────
    section('STEP 4: Create referee using referral code');
    const referee = await User.create({
        name: 'Test Referee',
        email: REFEREE_EMAIL,
        password: 'Test@1234',
        referralCode: 'TESTREF02',
        isEmailVerified: true,
        totalBalance: 2000,
        referredBy: referrer._id
    });
    pass(`Referee created: ${referee.email} | referredBy: ${referrer._id}`);

    // ── STEP 5: Referee makes first investment ────────────────────────────────
    section('STEP 5: Referee invests (triggers referral bonus)');
    const investAmount = 1000;

    const settings = await Settings.findOne();
    const config = settings?.referral || {
        rewardPercent: 3,
        maxRewardPerReferral: 5000,
        maxReferralsLifetime: 50,
        maxEarningsLifetime: 100000,
        unlockDays: 14
    };
    pass(`Referral config: ${config.rewardPercent}% reward, unlocks after ${config.unlockDays} days`);

    const investment = await UserInvestment.create({
        user: referee._id,
        plan: plan._id,
        amount: investAmount,
        dailyPayoutAmount: (investAmount * plan.dailyPayout) / 100,
        endDate: new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000),
        nextPayoutDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active'
    });
    referee.totalBalance -= investAmount;
    referee.totalInvested = investAmount;
    await referee.save();
    pass(`Referee invested $${investAmount}`);

    // Manually trigger referral bonus (same logic as invest controller)
    const { handleReferralBonusTest } = require('./referral-helper');
    await handleReferralBonusTest(referee, investAmount, config);

    // ── STEP 6: Verify referral transaction was created ───────────────────────
    section('STEP 6: Verify referral bonus transaction');
    const referralTx = await Transaction.findOne({
        user: referrer._id,
        type: 'Referral',
        status: 'Pending'
    });

    if (!referralTx) {
        fail('No referral transaction found for referrer');
    } else {
        const expectedReward = (investAmount * config.rewardPercent) / 100;
        pass(`Referral transaction created: $${referralTx.amount} (expected: $${expectedReward})`);
        pass(`Unlock date: ${referralTx.unlockDate}`);
        pass(`Status: ${referralTx.status}`);
        log('Referral TX', { amount: referralTx.amount, status: referralTx.status, unlockDate: referralTx.unlockDate });
    }

    // ── STEP 7: Verify referrer balance updated ───────────────────────────────
    section('STEP 7: Verify referrer referralBalance updated');
    const updatedReferrer = await User.findById(referrer._id);
    if (updatedReferrer.referralBalance > 0) {
        pass(`Referrer referralBalance: $${updatedReferrer.referralBalance}`);
        pass(`Referrer referralCount: ${updatedReferrer.referralCount}`);
        pass(`Referrer lifetimeReferralEarnings: $${updatedReferrer.lifetimeReferralEarnings}`);
    } else {
        fail(`Referrer referralBalance is 0 — bonus was not applied`);
    }

    // ── STEP 8: Simulate scheduler unlock (backdate unlockDate) ──────────────
    section('STEP 8: Simulate scheduler — backdate unlockDate and run processor');
    if (referralTx) {
        referralTx.unlockDate = new Date(Date.now() - 1000); // already past
        await referralTx.save();
        pass('Backdated unlockDate to past');

        await processReferralRewards();

        const processedTx = await Transaction.findById(referralTx._id);
        if (processedTx.status === 'Completed') {
            pass(`Referral reward unlocked! Status: ${processedTx.status}`);
        } else {
            fail(`Reward still ${processedTx.status} after scheduler run`);
        }

        const finalReferrer = await User.findById(referrer._id);
        pass(`Referrer totalBalance after unlock: $${finalReferrer.totalBalance}`);
        pass(`Referrer referralBalance after unlock: $${finalReferrer.referralBalance}`);

        const balanceIncreased = finalReferrer.totalBalance > updatedReferrer.totalBalance;
        balanceIncreased
            ? pass('totalBalance correctly increased after unlock')
            : fail('totalBalance did NOT increase after unlock');

        const referralBalanceDecreased = finalReferrer.referralBalance < updatedReferrer.referralBalance;
        referralBalanceDecreased
            ? pass('referralBalance correctly decreased after unlock')
            : fail('referralBalance did NOT decrease after unlock');
    }

    // ── STEP 9: Dashboard referral data check ─────────────────────────────────
    section('STEP 9: Verify dashboard referral data');
    const referralCount = await User.countDocuments({ referredBy: referrer._id });
    const completedReferralTxs = await Transaction.find({ user: referrer._id, type: 'Referral', status: 'Completed' });
    const totalEarned = completedReferralTxs.reduce((s, t) => s + t.amount, 0);

    pass(`Referral count: ${referralCount}`);
    pass(`Total referral earned (completed): $${totalEarned}`);
    referralCount === 1 ? pass('Referral count correct') : fail(`Expected 1, got ${referralCount}`);

    // ── STEP 10: Second investment should NOT trigger another bonus ───────────
    section('STEP 10: Second investment should NOT create another referral bonus');
    const txCountBefore = await Transaction.countDocuments({ user: referrer._id, type: 'Referral' });

    await UserInvestment.create({
        user: referee._id,
        plan: plan._id,
        amount: 500,
        dailyPayoutAmount: 7.5,
        endDate: new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000),
        nextPayoutDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active'
    });
    await handleReferralBonusTest(referee, 500, config);

    const txCountAfter = await Transaction.countDocuments({ user: referrer._id, type: 'Referral' });
    txCountAfter === txCountBefore
        ? pass('No duplicate referral bonus on second investment ✓')
        : fail(`Duplicate bonus created! Before: ${txCountBefore}, After: ${txCountAfter}`);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    await cleanup([REFERRER_EMAIL, REFEREE_EMAIL]);

    console.log('\n' + '═'.repeat(50));
    console.log('✅ All referral tests completed');
    console.log('═'.repeat(50));

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error('\n❌ Test crashed:', err);
    process.exit(1);
});
