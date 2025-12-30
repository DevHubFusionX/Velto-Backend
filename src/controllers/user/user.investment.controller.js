const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const Investment = require('../../models/Investment');
const Product = require('../../models/Product');
const InvestmentPlan = require('../../models/InvestmentPlan');
const UserInvestment = require('../../models/UserInvestment');
const Payout = require('../../models/Payout');
const Settings = require('../../models/Settings');
const { sendNotification, sendAdminNotification } = require('../../utils/notification');

const investmentController = {
    // @desc    Get all active investment plans (renamed for frontend compatibility)
    getProducts: async (req, res) => {
        try {
            const plans = await InvestmentPlan.find({ status: 'active' });

            // Map InvestmentPlan to legacy Product structure for frontend compatibility
            const products = plans.map(plan => ({
                _id: plan._id,
                id: plan._id,
                name: plan.name,
                type: plan.type,
                description: plan.description,
                minInvestment: {
                    usd: plan.minAmount,
                    ngn: plan.minAmount
                },
                maxInvestment: {
                    usd: plan.maxAmount,
                    ngn: plan.maxAmount
                },
                minAmount: plan.minAmount,
                maxAmount: plan.maxAmount,
                dailyPayout: plan.dailyPayout,
                isPercentage: plan.isPercentage,
                durationDays: plan.durationDays,
                roi: plan.roiDescription || `${plan.dailyPayout}${plan.isPercentage ? '%' : ''} Daily`,
                roiType: plan.isPercentage ? 'Percentage' : 'Fixed',
                duration: `${plan.durationDays} Days`,
                risk: plan.risk,
                status: plan.status,
                color: plan.color || '#a3e635',
                popular: false
            }));

            res.json(products);
        } catch (err) {
            console.error('Error fetching products:', err);
            res.status(500).json({ message: 'Error fetching products' });
        }
    },

    getOpportunities: async (req, res) => {
        try {
            const opportunities = await Product.find();
            res.json(opportunities);
        } catch (err) {
            res.status(500).json({ message: 'Error fetching opportunities' });
        }
    },

    // @desc    Get active plans (simple version)
    getPlans: async (req, res) => {
        try {
            const plans = await InvestmentPlan.find({ status: 'active' });
            res.status(200).json({ success: true, data: plans });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    },

    // @desc    User invests in a plan or legacy product
    invest: async (req, res) => {
        console.log('--- CONSOLIDATED INVEST CALLED ---');
        const { planId, productId, amount } = req.body;
        const targetId = planId || productId;
        const numAmount = parseFloat(amount);

        try {
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).json({ message: 'User not found' });

            if (user.totalBalance < numAmount) {
                return res.status(400).json({ success: false, error: 'Insufficient funds' });
            }

            // 1. Check for Investment Plan
            const plan = await InvestmentPlan.findById(targetId);
            if (plan) {
                if (numAmount < plan.minAmount || numAmount > plan.maxAmount) {
                    return res.status(400).json({ success: false, error: `Amount must be between ${plan.minAmount} and ${plan.maxAmount}` });
                }

                let dailyPayoutAmount;
                if (plan.isPercentage) {
                    dailyPayoutAmount = (numAmount * plan.dailyPayout) / 100;
                } else {
                    dailyPayoutAmount = plan.dailyPayout;
                }

                const startDate = new Date();
                const endDate = new Date();
                endDate.setDate(startDate.getDate() + plan.durationDays);
                const nextPayoutDate = new Date();
                nextPayoutDate.setDate(startDate.getDate() + 1);

                const investment = await UserInvestment.create({
                    user: user._id,
                    plan: plan._id,
                    amount: numAmount,
                    dailyPayoutAmount,
                    startDate,
                    endDate,
                    nextPayoutDate,
                    status: 'active'
                });

                await Transaction.create({
                    user: user._id,
                    type: 'Investment',
                    amount: -numAmount,
                    status: 'Completed',
                    reference: `INV-PLAN-${investment._id}`,
                    description: `Investment in plan: ${plan.name}`
                });

                user.totalBalance -= numAmount;
                user.totalInvested += numAmount;
                await user.save();

                // STRICT REFERRAL LOGIC
                await handleReferralBonus(user, numAmount);

                // Notifications
                await sendInvestmentNotifications(user, plan.name, numAmount, investment._id);

                return res.status(201).json({ success: true, data: investment });
            }

            // 2. Check for Legacy Product
            const product = await Product.findById(targetId);
            if (product) {
                const startDate = new Date();
                const maturityDate = new Date(startDate.getTime() + (product.durationDays || 365) * 24 * 60 * 60 * 1000);

                const investment = await Investment.create({
                    user: user._id,
                    product: product._id,
                    productName: product.name,
                    amount: numAmount,
                    currency: 'USD',
                    startDate,
                    maturityDate,
                    status: 'Active',
                    currentValue: numAmount,
                    roiPercent: parseFloat(product.roi) || 12,
                    payoutFrequency: 'Monthly'
                });

                await Transaction.create({
                    user: user._id,
                    type: 'Investment',
                    amount: -numAmount,
                    status: 'Completed',
                    reference: `INV-LEGACY-${investment._id}`,
                    description: `Investment in ${product.name}`
                });

                user.totalBalance -= numAmount;
                user.totalInvested += numAmount;
                await user.save();

                // STRICT REFERRAL LOGIC
                await handleReferralBonus(user, numAmount);

                // Notifications
                await sendInvestmentNotifications(user, product.name, numAmount, investment._id);

                return res.json({
                    success: true,
                    message: 'Investment successful',
                    data: investment
                });
            }

            return res.status(404).json({ success: false, error: 'Product/Plan not found' });

        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: 'Server Error' });
        }
    },

    getMyInvestments: async (req, res) => {
        try {
            // Fetch both legacy and new system investments
            const [newInvestments, legacyInvestments] = await Promise.all([
                UserInvestment.find({ user: req.user.id }).populate('plan'),
                Investment.find({ user: req.user.id })
            ]);

            // Map legacy investments to a structure the frontend expects
            const mappedLegacy = legacyInvestments.map(inv => {
                const amount = inv.amount || 0;
                const roi = inv.roiPercent || 12;
                // Pseudo daily payout for legacy: (amount * roi / 100) / 365
                const pseudoDaily = (amount * (roi / 100)) / 365;

                return {
                    ...inv.toObject(),
                    plan: {
                        name: inv.productName || 'Legacy Investment',
                        durationDays: 365 // Default for legacy
                    },
                    dailyPayoutAmount: pseudoDaily,
                    totalPayoutReceived: inv.totalEarned || 0,
                    nextPayoutDate: inv.maturityDate || inv.startDate
                };
            });

            const allInvestments = [...newInvestments, ...mappedLegacy];

            res.status(200).json({
                success: true,
                data: allInvestments
            });
        } catch (err) {
            console.error('Error in getMyInvestments:', err);
            res.status(400).json({ success: false, error: err.message });
        }
    },

    withdrawInvestment: async (req, res) => {
        try {
            const { investmentId } = req.params;
            const investment = await UserInvestment.findOne({ _id: investmentId, user: req.user.id });

            if (!investment) return res.status(404).json({ message: 'Investment not found' });
            if (investment.status !== 'active') return res.status(400).json({ message: 'Investment is not active' });

            const penaltyAmount = investment.amount * 0.10;
            const returnAmount = investment.amount - penaltyAmount;

            const user = await User.findById(req.user.id);
            user.totalBalance += returnAmount;
            await user.save();

            investment.status = 'terminated';
            investment.terminatedAt = new Date();
            investment.terminationReason = 'Early withdrawal by user';
            investment.penaltyAmount = penaltyAmount;
            await investment.save();

            await Payout.create({
                user: user._id,
                investment: investmentId,
                amount: returnAmount,
                type: 'withdrawal',
                notes: `Early withdrawal with ${penaltyAmount} penalty`
            });

            res.json({
                success: true,
                message: 'Investment withdrawn successfully',
                returnAmount,
                penaltyAmount,
                newBalance: user.totalBalance
            });
        } catch (err) {
            res.status(500).json({ message: 'Error processing withdrawal' });
        }
    },

    getPayoutHistory: async (req, res) => {
        try {
            const { limit = 50, skip = 0 } = req.query;
            const payouts = await Payout.find({ user: req.user.id })
                .populate({
                    path: 'investment',
                    populate: { path: 'plan' }
                })
                .sort({ date: -1 })
                .limit(parseInt(limit))
                .skip(parseInt(skip));

            const total = await Payout.countDocuments({ user: req.user.id });

            const formattedPayouts = payouts.map(p => ({
                id: p._id,
                amount: p.amount,
                type: p.type,
                date: p.date,
                planName: p.investment?.plan?.name || p.investment?.productName || 'N/A',
                notes: p.notes
            }));

            res.json({
                success: true,
                data: formattedPayouts,
                total,
                hasMore: (skip + payouts.length) < total
            });
        } catch (err) {
            res.status(500).json({ message: 'Error fetching payout history' });
        }
    }
};

// --- Helper Functions ---

async function handleReferralBonus(user, amount) {
    if (!user.referredBy) return;

    const settings = await Settings.findOne();
    const config = settings?.referral || {
        rewardPercent: 3,
        maxRewardPerReferral: 5000,
        maxReferralsLifetime: 50,
        maxEarningsLifetime: 100000,
        unlockDays: 14
    };

    const legacyCount = await Investment.countDocuments({ user: user._id });
    const newCount = await UserInvestment.countDocuments({ user: user._id });

    // Only on VERY FIRST investment
    if (legacyCount + newCount === 1) {
        const referrer = await User.findById(user.referredBy);
        if (referrer) {
            const isVerified = referrer.isEmailVerified;
            const hasInvestment = (await Investment.exists({ user: referrer._id })) ||
                (await UserInvestment.exists({ user: referrer._id }));

            const withinRefLimit = (referrer.referralCount || 0) < config.maxReferralsLifetime;
            const withinEarnLimit = (referrer.lifetimeReferralEarnings || 0) < config.maxEarningsLifetime;

            if (isVerified && hasInvestment && withinRefLimit && withinEarnLimit) {
                let rawReward = (amount * config.rewardPercent) / 100;
                let finalReward = Math.min(rawReward, config.maxRewardPerReferral);

                if ((referrer.lifetimeReferralEarnings || 0) + finalReward > config.maxEarningsLifetime) {
                    finalReward = config.maxEarningsLifetime - (referrer.lifetimeReferralEarnings || 0);
                }

                if (finalReward > 0) {
                    const unlockDate = new Date();
                    unlockDate.setDate(unlockDate.getDate() + (config.unlockDays || 14));

                    await Transaction.create({
                        user: referrer._id,
                        type: 'Referral',
                        amount: finalReward,
                        status: 'Pending',
                        unlockDate: unlockDate,
                        reference: `REF-PENDING-${user._id}-${Date.now()}`,
                        description: `Pending referral reward (${config.rewardPercent}%) for ${user.name}'s first investment`
                    });

                    referrer.referralBalance = (referrer.referralBalance || 0) + finalReward;
                    referrer.referralCount = (referrer.referralCount || 0) + 1;
                    referrer.lifetimeReferralEarnings = (referrer.lifetimeReferralEarnings || 0) + finalReward;
                    await referrer.save();

                    console.log(`[REFERRAL] Pending reward log for Referrer: ${referrer.email}`);
                }
            }
        }
    }
}

async function sendInvestmentNotifications(user, name, amount, investmentId) {
    await sendNotification(
        user._id,
        'Investment Created',
        `You have successfully invested ₦${amount} in the ${name} plan.`,
        'investment',
        'normal',
        { investmentId, amount }
    );

    const isHighValue = amount >= 1000;
    await sendAdminNotification(
        isHighValue ? '🔥 High-Value Investment Alert' : 'New Investment Created',
        `User ${user.email} invested ₦${amount} in ${name}.`,
        'admin',
        isHighValue ? 'high' : 'normal',
        { investmentId, userId: user._id, amount }
    );
}

module.exports = investmentController;
