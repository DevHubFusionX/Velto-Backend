/**
 * Exposes handleReferralBonus for test scripts
 * Mirrors exact logic in user.investment.controller.js
 */
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const Investment = require('../src/models/Investment');
const UserInvestment = require('../src/models/UserInvestment');

async function handleReferralBonusTest(user, amount, config) {
    if (!user.referredBy) return;

    const legacyCount = await Investment.countDocuments({ user: user._id });
    const newCount = await UserInvestment.countDocuments({ user: user._id });

    // Only on VERY FIRST investment
    if (legacyCount + newCount !== 1) return;

    const referrer = await User.findById(user.referredBy);
    if (!referrer) return;

    const isVerified = referrer.isEmailVerified;
    const hasInvestment = (await Investment.exists({ user: referrer._id })) ||
        (await UserInvestment.exists({ user: referrer._id }));
    const withinRefLimit = (referrer.referralCount || 0) < config.maxReferralsLifetime;
    const withinEarnLimit = (referrer.lifetimeReferralEarnings || 0) < config.maxEarningsLifetime;

    if (!isVerified || !hasInvestment || !withinRefLimit || !withinEarnLimit) {
        console.log(`  ⚠️  Referral conditions not met: verified=${isVerified}, hasInvestment=${hasInvestment}, withinRefLimit=${withinRefLimit}, withinEarnLimit=${withinEarnLimit}`);
        return;
    }

    let rawReward = (amount * config.rewardPercent) / 100;
    let finalReward = Math.min(rawReward, config.maxRewardPerReferral);

    if ((referrer.lifetimeReferralEarnings || 0) + finalReward > config.maxEarningsLifetime) {
        finalReward = config.maxEarningsLifetime - (referrer.lifetimeReferralEarnings || 0);
    }

    if (finalReward <= 0) return;

    const unlockDate = new Date();
    unlockDate.setDate(unlockDate.getDate() + (config.unlockDays || 14));

    await Transaction.create({
        user: referrer._id,
        type: 'Referral',
        amount: finalReward,
        status: 'Pending',
        unlockDate,
        reference: `REF-PENDING-${user._id}-${Date.now()}`,
        description: `Pending referral reward (${config.rewardPercent}%) for ${user.name}'s first investment`
    });

    referrer.referralBalance = (referrer.referralBalance || 0) + finalReward;
    referrer.referralCount = (referrer.referralCount || 0) + 1;
    referrer.lifetimeReferralEarnings = (referrer.lifetimeReferralEarnings || 0) + finalReward;
    await referrer.save();
}

module.exports = { handleReferralBonusTest };
