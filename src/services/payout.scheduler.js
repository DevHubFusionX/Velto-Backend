const cron = require('node-cron');
const mongoose = require('mongoose');
const UserInvestment = require('../models/UserInvestment');
const User = require('../models/User');
const Payout = require('../models/Payout');
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');

// Prevent concurrent runs
let isPayoutRunning = false;
let isReferralRunning = false;

const processPayouts = async () => {
    if (isPayoutRunning) {
        console.log('[Payout Scheduler] Already running, skipping...');
        return;
    }
    isPayoutRunning = true;

    try {
        const now = new Date();

        const dueInvestments = await UserInvestment.find({
            status: 'active',
            nextPayoutDate: { $lte: now }
        }).populate('user', 'email totalBalance totalReturns')
          .populate('plan', 'name');

        if (dueInvestments.length === 0) {
            console.log('[Payout Scheduler] No payouts due.');
            return;
        }

        console.log(`[Payout Scheduler] Processing ${dueInvestments.length} due investments...`);

        let totalPaid = 0;
        let processed = 0;

        for (const investment of dueInvestments) {
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                // Re-fetch investment inside transaction to prevent double-pay race condition
                const fresh = await UserInvestment.findOne({
                    _id: investment._id,
                    status: 'active',
                    nextPayoutDate: { $lte: now }
                }).session(session);

                if (!fresh) {
                    // Already processed by another instance
                    await session.abortTransaction();
                    session.endSession();
                    continue;
                }

                const payoutAmount = fresh.dailyPayoutAmount;
                const isLastPayout = new Date(fresh.endDate) <= new Date(fresh.nextPayoutDate.getTime() + 24 * 60 * 60 * 1000);
                const nextPayoutDate = new Date(fresh.nextPayoutDate.getTime() + 24 * 60 * 60 * 1000);

                // Update investment atomically
                await UserInvestment.findByIdAndUpdate(fresh._id, {
                    $inc: { totalPayoutReceived: payoutAmount },
                    $set: {
                        nextPayoutDate,
                        status: isLastPayout ? 'completed' : 'active'
                    }
                }, { session });

                // Credit user balance atomically
                await User.findByIdAndUpdate(fresh.user, {
                    $inc: { totalBalance: payoutAmount, totalReturns: payoutAmount }
                }, { session });

                // Create payout record
                await Payout.create([{
                    user: fresh.user,
                    investment: fresh._id,
                    amount: payoutAmount,
                    type: isLastPayout ? 'final' : 'daily',
                    notes: `${isLastPayout ? 'Final' : 'Daily'} payout — $${payoutAmount} | Plan: ${investment.plan?.name || 'Investment'}`
                }], { session });

                // Create transaction for user history
                await Transaction.create([{
                    user: fresh.user,
                    type: 'Investment Return',
                    amount: payoutAmount,
                    status: 'Completed',
                    reference: `ROI-${fresh._id}-${Date.now()}`,
                    description: `${isLastPayout ? 'Final' : 'Daily'} ROI — ${investment.plan?.name || 'Investment'}`
                }], { session });

                await session.commitTransaction();
                session.endSession();

                totalPaid += payoutAmount;
                processed++;

                console.log(`[Payout Scheduler] ✅ Paid $${payoutAmount} to ${investment.user?.email}${isLastPayout ? ' (FINAL)' : ''}`);
            } catch (err) {
                await session.abortTransaction();
                session.endSession();
                console.error(`[Payout Scheduler] ❌ Failed investment ${investment._id}:`, err.message);
            }
        }

        console.log(`[Payout Scheduler] Done — ${processed} payouts, $${totalPaid.toFixed(2)} total distributed.`);
    } catch (err) {
        console.error('[Payout Scheduler] Fatal error:', err.message);
    } finally {
        isPayoutRunning = false;
    }
};

const processReferralRewards = async () => {
    if (isReferralRunning) return;
    isReferralRunning = true;

    try {
        const now = new Date();

        const pendingRewards = await Transaction.find({
            type: 'Referral',
            status: 'Pending',
            unlockDate: { $lte: now }
        });

        if (pendingRewards.length === 0) return;

        console.log(`[Referral Scheduler] Processing ${pendingRewards.length} matured rewards...`);

        // Batch check active investments for all referrers at once
        const userIds = [...new Set(pendingRewards.map(r => r.user.toString()))];

        const [activeOld, activeNew] = await Promise.all([
            Investment.distinct('user', { user: { $in: userIds }, status: 'Active' }),
            UserInvestment.distinct('user', { user: { $in: userIds }, status: 'active' })
        ]);

        const activeSet = new Set([
            ...activeOld.map(id => id.toString()),
            ...activeNew.map(id => id.toString())
        ]);

        for (const reward of pendingRewards) {
            try {
                const userId = reward.user.toString();

                if (!activeSet.has(userId)) {
                    console.log(`[Referral Scheduler] ⏳ User ${userId} has no active investment — reward held.`);
                    continue;
                }

                await User.findByIdAndUpdate(reward.user, {
                    $inc: { totalBalance: reward.amount },
                    $inc: { referralBalance: -reward.amount }
                });

                reward.status = 'Completed';
                await reward.save();

                console.log(`[Referral Scheduler] ✅ Unlocked $${reward.amount} for user ${userId}`);
            } catch (err) {
                console.error(`[Referral Scheduler] ❌ Failed reward ${reward._id}:`, err.message);
            }
        }
    } catch (err) {
        console.error('[Referral Scheduler] Fatal error:', err.message);
    } finally {
        isReferralRunning = false;
    }
};

const initializeScheduler = () => {
    // Run every minute — checks are cheap, only processes investments that are actually due
    cron.schedule('* * * * *', async () => {
        await processPayouts();
        await processReferralRewards();
    });

    // Also run immediately on startup to catch any overdue payouts
    setTimeout(async () => {
        console.log('[Payout Scheduler] Running startup check...');
        await processPayouts();
        await processReferralRewards();
    }, 3000);

    console.log('[Payout Scheduler] Initialized - Running every minute');
};

const triggerManualPayout = async () => {
    console.log('[Payout Scheduler] Manual payout triggered by admin');
    await processPayouts();
};

module.exports = {
    initializeScheduler,
    triggerManualPayout,
    processPayouts,
    processReferralRewards
};
