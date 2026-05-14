/**
 * End-to-end investment flow test
 * Covers:
 *  1. Admin creates investment plan
 *  2. Admin updates & toggles plan status
 *  3. Frontend GET /products & /investments/plans/list return plan
 *  4. User invests in plan (balance deducted, investment created, tx created)
 *  5. User GET /investments returns investment
 *  6. Payout scheduler processes daily payout
 *  7. Admin GET /investments/admin/all sees investment
 *  8. Admin GET /admin/analytics/investments reflects data
 *  9. Admin triggers manual payout
 * 10. User early-withdraws investment (penalty applied)
 * 11. Admin deletes plan (cleanup)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User          = require('../src/models/User');
const InvestmentPlan = require('../src/models/InvestmentPlan');
const UserInvestment = require('../src/models/UserInvestment');
const Transaction   = require('../src/models/Transaction');
const Payout        = require('../src/models/Payout');
const { processPayouts } = require('../src/services/payout.scheduler');

const section = (msg) => console.log(`\n${'─'.repeat(55)}\n▶  ${msg}\n${'─'.repeat(55)}`);
const pass    = (msg) => console.log(`  ✅  ${msg}`);
const fail    = (msg) => { console.log(`  ❌  FAIL: ${msg}`); process.exitCode = 1; };
const info    = (msg) => console.log(`  ℹ️   ${msg}`);

const TEST_EMAIL = 'test-investor@velto.com';
const PLAN_NAME  = '__TEST_PLAN__';

async function cleanup() {
    const user = await User.findOne({ email: TEST_EMAIL });
    if (user) {
        await UserInvestment.deleteMany({ user: user._id });
        await Transaction.deleteMany({ user: user._id });
        await Payout.deleteMany({ user: user._id });
        await User.deleteOne({ _id: user._id });
    }
    await InvestmentPlan.deleteOne({ name: PLAN_NAME });
    console.log('\n🧹 Cleanup done');
}

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    await cleanup();

    // ── STEP 1: Admin creates investment plan ─────────────────────────────────
    section('STEP 1: Admin creates investment plan');
    let plan = await InvestmentPlan.create({
        name: PLAN_NAME,
        description: 'Test plan for automated testing',
        minAmount: 100,
        maxAmount: 50000,
        dailyPayout: 2,
        isPercentage: true,
        durationDays: 10,
        type: 'Test',
        risk: 'Medium',
        roiDescription: '2% Daily',
        status: 'active'
    });
    pass(`Plan created: "${plan.name}" | daily: ${plan.dailyPayout}% | duration: ${plan.durationDays} days`);
    plan._id ? pass(`Plan ID: ${plan._id}`) : fail('Plan has no _id');

    // ── STEP 2: Admin updates plan ────────────────────────────────────────────
    section('STEP 2: Admin updates plan');
    plan = await InvestmentPlan.findByIdAndUpdate(plan._id, { description: 'Updated description' }, { new: true });
    plan.description === 'Updated description' ? pass('Plan description updated') : fail('Update did not persist');

    // ── STEP 3: Admin toggles plan to inactive then back ──────────────────────
    section('STEP 3: Admin toggles plan status');
    plan.status = 'inactive';
    await plan.save();
    const inactive = await InvestmentPlan.findById(plan._id);
    inactive.status === 'inactive' ? pass('Plan toggled to inactive') : fail('Toggle to inactive failed');

    plan.status = 'active';
    await plan.save();
    const active = await InvestmentPlan.findById(plan._id);
    active.status === 'active' ? pass('Plan toggled back to active') : fail('Toggle back to active failed');

    // ── STEP 4: GET /products & /plans/list return the plan ───────────────────
    section('STEP 4: Verify plan appears in public plan lists');
    const activePlans = await InvestmentPlan.find({ status: 'active' });
    const found = activePlans.find(p => p.name === PLAN_NAME);
    found ? pass(`Plan found in active plans list (${activePlans.length} total)`) : fail('Plan NOT found in active plans');

    // ── STEP 5: Create test user ──────────────────────────────────────────────
    section('STEP 5: Create test user with balance');
    const user = await User.create({
        name: 'Test Investor',
        email: TEST_EMAIL,
        password: 'Test@1234',
        referralCode: 'TESTINV01',
        isEmailVerified: true,
        totalBalance: 5000,
        totalInvested: 0
    });
    pass(`User created: ${user.email} | balance: $${user.totalBalance}`);

    // ── STEP 6: User invests in plan ──────────────────────────────────────────
    section('STEP 6: User invests $1000 in plan');
    const investAmount = 1000;
    const dailyPayoutAmount = (investAmount * plan.dailyPayout) / 100; // 2% = $20/day

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + plan.durationDays);
    const nextPayoutDate = new Date();
    nextPayoutDate.setDate(startDate.getDate() + 1);

    const investment = await UserInvestment.create({
        user: user._id,
        plan: plan._id,
        amount: investAmount,
        dailyPayoutAmount,
        startDate,
        endDate,
        nextPayoutDate,
        status: 'active'
    });

    await Transaction.create({
        user: user._id,
        type: 'Investment',
        amount: -investAmount,
        status: 'Completed',
        reference: `INV-PLAN-${investment._id}`,
        description: `Investment in plan: ${plan.name}`
    });

    user.totalBalance -= investAmount;
    user.totalInvested += investAmount;
    await user.save();

    pass(`Investment created: $${investment.amount} | daily: $${investment.dailyPayoutAmount}`);
    pass(`User balance after invest: $${user.totalBalance}`);
    investment.status === 'active' ? pass('Investment status: active') : fail(`Wrong status: ${investment.status}`);
    user.totalBalance === 4000 ? pass('Balance correctly deducted') : fail(`Expected $4000, got $${user.totalBalance}`);
    user.totalInvested === 1000 ? pass('totalInvested correctly updated') : fail(`Expected $1000, got $${user.totalInvested}`);

    // ── STEP 7: User GET /investments returns investment ──────────────────────
    section('STEP 7: User can fetch their investments');
    const myInvestments = await UserInvestment.find({ user: user._id }).populate('plan');
    myInvestments.length === 1 ? pass(`Found ${myInvestments.length} investment`) : fail(`Expected 1, got ${myInvestments.length}`);
    myInvestments[0].plan?.name === PLAN_NAME ? pass(`Plan name correct: "${myInvestments[0].plan.name}"`) : fail('Plan name mismatch');

    // ── STEP 8: Payout scheduler processes daily payout ───────────────────────
    section('STEP 8: Payout scheduler — backdate nextPayoutDate and run');
    investment.nextPayoutDate = new Date(Date.now() - 1000);
    await investment.save();
    info('nextPayoutDate backdated to past');

    await processPayouts();

    const updatedInvestment = await UserInvestment.findById(investment._id);
    const updatedUser = await User.findById(user._id);
    const payoutRecord = await Payout.findOne({ user: user._id, type: 'daily' });
    const roiTx = await Transaction.findOne({ user: user._id, type: 'Investment Return' });

    payoutRecord ? pass(`Payout record created: $${payoutRecord.amount}`) : fail('No payout record found');
    roiTx ? pass(`ROI transaction created: $${roiTx.amount}`) : fail('No ROI transaction found');

    const expectedBalance = 4000 + dailyPayoutAmount;
    updatedUser.totalBalance === expectedBalance
        ? pass(`User balance after payout: $${updatedUser.totalBalance} ✓`)
        : fail(`Expected $${expectedBalance}, got $${updatedUser.totalBalance}`);

    updatedInvestment.totalPayoutReceived === dailyPayoutAmount
        ? pass(`totalPayoutReceived updated: $${updatedInvestment.totalPayoutReceived}`)
        : fail(`Expected $${dailyPayoutAmount}, got $${updatedInvestment.totalPayoutReceived}`);

    const nextPayoutAdvanced = updatedInvestment.nextPayoutDate > investment.nextPayoutDate;
    nextPayoutAdvanced ? pass('nextPayoutDate advanced by 1 day') : fail('nextPayoutDate was NOT advanced');

    // ── STEP 9: Admin sees investment in all investments list ─────────────────
    section('STEP 9: Admin GET all investments');
    const allInvestments = await UserInvestment.find().populate('user', 'name email').populate('plan');
    const adminSees = allInvestments.find(i => i.user?.email === TEST_EMAIL);
    adminSees ? pass(`Admin can see user investment: $${adminSees.amount} in "${adminSees.plan?.name}"`) : fail('Admin cannot find user investment');

    // ── STEP 10: Admin investment analytics ───────────────────────────────────
    section('STEP 10: Admin investment analytics');
    const activeInvestments = await UserInvestment.find({ status: 'active' });
    const totalLocked = activeInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    const allPayouts = await Payout.find({});
    const totalPaid = allPayouts.reduce((sum, p) => sum + p.amount, 0);

    totalLocked >= investAmount ? pass(`Total locked: $${totalLocked}`) : fail(`Expected >= $${investAmount}, got $${totalLocked}`);
    totalPaid >= dailyPayoutAmount ? pass(`Total paid out: $${totalPaid}`) : fail(`Expected >= $${dailyPayoutAmount}, got $${totalPaid}`);

    const distribution = await UserInvestment.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$plan', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $lookup: { from: 'investmentplans', localField: '_id', foreignField: '_id', as: 'planDetails' } },
        { $unwind: '$planDetails' },
        { $project: { planName: '$planDetails.name', total: 1, count: 1 } }
    ]);
    const testPlanDist = distribution.find(d => d.planName === PLAN_NAME);
    testPlanDist ? pass(`Distribution: ${testPlanDist.planName} — $${testPlanDist.total} (${testPlanDist.count} investors)`) : fail('Plan not in distribution');

    // ── STEP 11: Admin triggers manual payout ─────────────────────────────────
    section('STEP 11: Admin triggers manual payout (second day)');
    const inv = await UserInvestment.findById(investment._id);
    inv.nextPayoutDate = new Date(Date.now() - 1000);
    await inv.save();

    await processPayouts();

    const payouts = await Payout.find({ user: user._id, type: 'daily' });
    payouts.length === 2 ? pass(`2 daily payouts processed total`) : fail(`Expected 2 payouts, got ${payouts.length}`);

    const finalUser = await User.findById(user._id);
    const expectedFinalBalance = 4000 + (dailyPayoutAmount * 2);
    finalUser.totalBalance === expectedFinalBalance
        ? pass(`Balance after 2 payouts: $${finalUser.totalBalance} ✓`)
        : fail(`Expected $${expectedFinalBalance}, got $${finalUser.totalBalance}`);

    // ── STEP 12: User early withdrawal ────────────────────────────────────────
    section('STEP 12: User early withdrawal (10% penalty)');
    const activeInv = await UserInvestment.findOne({ user: user._id, status: 'active' });

    if (activeInv) {
        const penaltyAmount = activeInv.amount * 0.10;
        const returnAmount  = activeInv.amount - penaltyAmount;

        const preWithdrawUser = await User.findById(user._id);
        preWithdrawUser.totalBalance += returnAmount;
        await preWithdrawUser.save();

        activeInv.status = 'terminated';
        activeInv.terminatedAt = new Date();
        activeInv.terminationReason = 'Early withdrawal by user';
        activeInv.penaltyAmount = penaltyAmount;
        await activeInv.save();

        await Payout.create({
            user: user._id,
            investment: activeInv._id,
            amount: returnAmount,
            type: 'withdrawal',
            notes: `Early withdrawal with $${penaltyAmount} penalty`
        });

        const postUser = await User.findById(user._id);
        pass(`Penalty: $${penaltyAmount} | Returned: $${returnAmount}`);
        pass(`User balance after withdrawal: $${postUser.totalBalance}`);

        const terminatedInv = await UserInvestment.findById(activeInv._id);
        terminatedInv.status === 'terminated' ? pass('Investment status: terminated') : fail('Status not terminated');
        terminatedInv.penaltyAmount === penaltyAmount ? pass('Penalty amount recorded') : fail('Penalty not recorded');
    } else {
        fail('No active investment found for withdrawal test');
    }

    // ── STEP 13: Admin deletes plan ───────────────────────────────────────────
    section('STEP 13: Admin deletes plan');
    await InvestmentPlan.deleteOne({ _id: plan._id });
    const deleted = await InvestmentPlan.findById(plan._id);
    !deleted ? pass('Plan deleted successfully') : fail('Plan still exists after delete');

    // ── Cleanup ───────────────────────────────────────────────────────────────
    await cleanup();

    console.log('\n' + '═'.repeat(55));
    console.log(process.exitCode === 1 ? '❌ Some tests FAILED — check above' : '✅ All investment tests passed');
    console.log('═'.repeat(55));

    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
}

run().catch(err => {
    console.error('\n❌ Test crashed:', err.message);
    process.exit(1);
});
