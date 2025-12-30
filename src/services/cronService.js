const cron = require('node-cron');
const UserInvestment = require('../models/UserInvestment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { sendNotification } = require('../utils/notification');

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

                await investment.save();

                // 4. Send Notification
                await sendNotification(
                    user._id,
                    'ROI Payout Credited',
                    `Your daily payout of ${investment.dailyPayoutAmount} has been credited for your investment.`,
                    'success',
                    'low',
                    { investmentId: investment._id }
                );

                // Check if investment is completed
                if (nextPayoutDate > investment.endDate) {
                    investment.status = 'completed';
                    await investment.save();
                    
                    await sendNotification(
                        user._id,
                        'Investment Completed',
                        `Your investment in the ${investment.plan} has reached its completion date.`,
                        'success',
                        'normal',
                        { investmentId: investment._id }
                    );
                    console.log(`Investment ${investment._id} completed.`);
                }

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
