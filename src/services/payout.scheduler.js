const cron = require('node-cron');
const UserInvestment = require('../models/UserInvestment');
const User = require('../models/User');
const Payout = require('../models/Payout');
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');

/**
 * Process all due payouts
 * Runs hourly to distribute daily returns to users
 */
const processPayouts = async () => {
    try {
        console.log('[Payout Scheduler] Running payout processor...');

        const now = new Date();

        // Find all active investments with due payouts
        const dueInvestments = await UserInvestment.find({
            status: 'active',
            nextPayoutDate: { $lte: now }
        }).populate('user plan');

        console.log(`[Payout Scheduler] Found ${dueInvestments.length} investments due for payout`);

        for (const investment of dueInvestments) {
            try {
                // Check if investment has matured
                if (new Date(investment.endDate) <= now) {
                    // Mark as completed
                    investment.status = 'completed';
                    await investment.save();

                    // Create completion payout record
                    await Payout.create({
                        user: investment.user._id,
                        investment: investment._id,
                        amount: 0,
                        type: 'completion',
                        notes: 'Investment matured and completed'
                    });

                    console.log(`[Payout Scheduler] Completed investment ${investment._id}`);
                    continue;
                }

                // Process payout
                const payoutAmount = investment.dailyPayoutAmount;

                // Update user balance
                investment.user.totalBalance += payoutAmount;
                investment.user.totalReturns = (investment.user.totalReturns || 0) + payoutAmount;
                await investment.user.save();

                // Update investment
                investment.totalPayoutReceived += payoutAmount;
                investment.nextPayoutDate = new Date(investment.nextPayoutDate.getTime() + 24 * 60 * 60 * 1000); // +1 day
                await investment.save();

                // Create payout record
                await Payout.create({
                    user: investment.user._id,
                    investment: investment._id,
                    amount: payoutAmount,
                    type: 'daily',
                    notes: 'Daily payout processed'
                });

                // Create Transaction Record (for user history)
                await Transaction.create({
                    user: investment.user._id,
                    type: 'Investment Return',
                    amount: payoutAmount,
                    status: 'Completed',
                    reference: `ROI-${investment._id}-${Date.now()}`,
                    description: `Daily ROI for plan: ${investment.plan ? investment.plan.name : 'Investment'}`,
                });

                console.log(`[Payout Scheduler] Paid $${payoutAmount} to user ${investment.user.email} for investment ${investment._id}`);
            } catch (error) {
                console.error(`[Payout Scheduler] Error processing investment ${investment._id}:`, error);
            }
        }

        console.log('[Payout Scheduler] Payout processing completed');
    } catch (error) {
        console.error('[Payout Scheduler] Fatal error in payout processor:', error);
    }
};

/**
 * Process matured referral rewards
 * Unlocks rewards after 14 days if referrer has active investment
 */
const processReferralRewards = async () => {
    try {
        console.log('[Referral Scheduler] Running referral reward processor...');
        const now = new Date();

        // Find pending referral rewards that have reached their unlock date
        const pendingRewards = await Transaction.find({
            type: 'Referral',
            status: 'Pending',
            unlockDate: { $lte: now }
        });

        console.log(`[Referral Scheduler] Found ${pendingRewards.length} matured referral rewards to check`);

        for (const reward of pendingRewards) {
            try {
                const user = await User.findById(reward.user);
                if (!user) continue;

                // Rule: Referrer must have an active investment to unlock
                const hasActiveInvestment = (await Investment.exists({ user: user._id, status: 'Active' })) ||
                    (await UserInvestment.exists({ user: user._id, status: 'active' }));

                if (hasActiveInvestment) {
                    // Unlock reward
                    user.referralBalance -= reward.amount;
                    user.totalBalance += reward.amount;
                    await user.save();

                    reward.status = 'Completed';
                    reward.description = reward.description.replace('Pending', 'Unlocked');
                    await reward.save();

                    console.log(`[Referral Scheduler] ✅ Unlocked $${reward.amount} for user ${user.email}`);
                } else {
                    console.log(`[Referral Scheduler] ⏳ User ${user.email} has no active investment. Reward ${reward._id} remains pending.`);
                }
            } catch (err) {
                console.error(`[Referral Scheduler] Error processing reward ${reward._id}:`, err);
            }
        }
    } catch (error) {
        console.error('[Referral Scheduler] Fatal error in referral processor:', error);
    }
};

/**
 * Initialize payout scheduler
 * Runs every hour
 */
const initializeScheduler = () => {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        await processPayouts();
        await processReferralRewards();
    });

    console.log('[Payout Scheduler] Initialized - Running every hour');

    // Optional: Run immediately on startup for verification if in dev
    if (process.env.NODE_ENV === 'development') {
        processReferralRewards();
    }
};

/**
 * Manual trigger for payouts (for admin control)
 */
const triggerManualPayout = async () => {
    console.log('[Payout Scheduler] Manual payout triggered by admin');
    await processPayouts();
};

module.exports = {
    initializeScheduler,
    triggerManualPayout,
    processPayouts
};
