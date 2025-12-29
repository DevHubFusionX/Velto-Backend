const cron = require('node-cron');
const UserInvestment = require('../models/UserInvestment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const runDailyPayouts = async () => {
    console.log('Running daily payout cron job...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        // Find investments that are active and due for payout (nextPayoutDate <= now)
        const investments = await UserInvestment.find({
            status: 'active',
            nextPayoutDate: { $lte: new Date() }
        });

        console.log(`Found ${investments.length} investments to process.`);

        for (const investment of investments) {
            try {
                // 1. Add payout to user wallet
                const user = await User.findById(investment.user);
                if (!user) continue;

                user.totalBalance += investment.dailyPayoutAmount;
                user.totalReturns += investment.dailyPayoutAmount;
                await user.save();

                // 2. Create Transaction Record
                await Transaction.create({
                    user: user._id,
                    type: 'Investment Return',
                    amount: investment.dailyPayoutAmount,
                    status: 'Completed',
                    reference: `INV-${investment._id}-${Date.now()}`,
                    description: `Daily ROI for plan: ${investment.plan}`, // Ideally populate plan details if needed
                });

                // 3. Update Investment Record
                investment.totalPayoutReceived += investment.dailyPayoutAmount;
                
                // Calculate next payout date (add 1 day)
                const nextDate = new Date(investment.nextPayoutDate);
                nextDate.setDate(nextDate.getDate() + 1);
                investment.nextPayoutDate = nextDate;

                // Check if investment is completed (EndDate reached or total payouts met)
                // Using EndDate as the primary completion trigger
                 if (nextDate > investment.endDate) {
                    investment.status = 'completed';
                    console.log(`Investment ${investment._id} completed.`);
                }

                await investment.save();

            } catch (err) {
                console.error(`Error processing investment ${investment._id}:`, err);
            }
        }
        console.log('Daily payout cron job finished.');

    } catch (error) {
        console.error('Error in daily payout cron:', error);
    }
};

// Schedule to run every day at midnight (00:00)
// For testing/demo purposes, we can verify this manually or set it to run more frequently if needed.
const startCronOnly = () => {
   cron.schedule('0 0 * * *', runDailyPayouts);
};

module.exports = { startCronOnly, runDailyPayouts };
