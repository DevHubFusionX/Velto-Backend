const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const Investment = require('../../models/Investment');
const InvestmentPlan = require('../../models/InvestmentPlan');
const UserInvestment = require('../../models/UserInvestment');
const Payout = require('../../models/Payout');
const FeatureFlag = require('../../models/FeatureFlag');
const Settings = require('../../models/Settings');

const profileController = {
    getProfile: async (req, res) => {
        try {
            const user = await User.findById(req.user.id);
            res.json(user);
        } catch (err) {
            res.status(500).json({ message: 'Error fetching profile' });
        }
    },

    updateProfile: async (req, res) => {
        try {
            const user = await User.findByIdAndUpdate(req.user.id, req.body, {
                new: true,
                runValidators: true
            });
            res.json({
                message: 'Profile updated successfully',
                user
            });
        } catch (err) {
            res.status(500).json({ message: 'Error updating profile' });
        }
    },

    getDashboard: async (req, res) => {
        try {
            const user = await User.findById(req.user.id);

            // Legacy Investments
            const investments = await Investment.find({ user: req.user.id, status: 'Active' });

            // New System Investments
            const userInvestments = await UserInvestment.find({ user: req.user.id, status: 'active' }).populate('plan');

            const transactions = await Transaction.find({ user: req.user.id }).sort({ date: -1 }).limit(5);

            // Combine and Normalize Investments
            const mappedOldInvestments = investments.map(inv => ({
                ...inv._doc,
                id: inv._id,
                startDate: inv.startDate.toISOString().split('T')[0],
                maturityDate: inv.maturityDate ? inv.maturityDate.toISOString().split('T')[0] : null,
                planName: inv.productName || 'Investment',
                type: 'Legacy'
            }));

            const mappedNewInvestments = userInvestments.map(inv => {
                const maturityDate = new Date(inv.endDate);
                return {
                    ...inv._doc,
                    id: inv._id,
                    productName: inv.plan?.name || 'Investment Plan',
                    planName: inv.plan?.name || 'Investment Plan',
                    amount: inv.amount,
                    currency: 'USD',
                    currentValue: inv.amount,
                    totalPayoutReceived: inv.totalPayoutReceived || 0,
                    roiPercent: (inv.plan?.dailyPayout || 0) * (inv.plan?.durationDays || 30),
                    startDate: inv.startDate.toISOString().split('T')[0],
                    maturityDate: maturityDate.toISOString().split('T')[0],
                    status: 'Active',
                    type: 'Standard'
                };
            });

            const allActiveInvestments = [...mappedOldInvestments, ...mappedNewInvestments];

            // Referral Statistics
            const referralCount = await User.countDocuments({ referredBy: req.user.id });
            const referralTransactions = await Transaction.find({
                user: req.user.id,
                type: 'Referral',
                status: 'Completed'
            });
            const totalReferralEarned = referralTransactions.reduce((sum, tx) => sum + tx.amount, 0);

            // Referral History
            const recentlyReferred = await User.find({ referredBy: req.user.id })
                .sort({ joinDate: -1 })
                .limit(5);

            const referralHistory = await Promise.all(recentlyReferred.map(async (ref) => {
                const bonusTx = await Transaction.findOne({
                    user: req.user.id,
                    type: 'Referral',
                    description: { $regex: new RegExp(ref.name, 'i') }
                });

                return {
                    name: ref.name,
                    date: ref.joinDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    status: (await Investment.exists({ user: ref._id })) || (await UserInvestment.exists({ user: ref._id })) ? 'Active' : 'Joined',
                    bonus: bonusTx ? bonusTx.amount : 0
                };
            }));

            // Fetch Active Investment Plans
            const plans = await InvestmentPlan.find({ status: 'active' });
            const products = plans.map(plan => ({
                _id: plan._id,
                id: plan._id,
                name: plan.name,
                type: plan.type,
                description: plan.description,
                minInvestment: { usd: plan.minAmount },
                maxInvestment: { usd: plan.maxAmount },
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

            // Allocation Analytics
            const allocationMap = {};
            let totalActiveInvested = 0;

            allActiveInvestments.forEach(inv => {
                const type = inv.plan?.type || inv.type || 'Standard';
                const amount = inv.amount || 0;
                allocationMap[type] = (allocationMap[type] || 0) + amount;
                totalActiveInvested += amount;
            });

            const allocationPercentages = Object.entries(allocationMap).map(([name, value]) => ({
                name,
                value: totalActiveInvested > 0 ? Math.round((value / totalActiveInvested) * 100) : 0,
                color: name === 'Stocks' ? '#60a5fa' :
                    name === 'Crypto' ? '#f59e0b' :
                        name === 'Real Estate' ? '#a3e635' : '#94a3b8'
            }));

            // Growth Analytics
            const recentPayouts = await Payout.find({ user: req.user.id, type: 'daily' })
                .sort({ date: -1 })
                .limit(6);

            const historicalGrowth = recentPayouts.reverse().map(p => ({
                date: p.date.toISOString().split('T')[0],
                returns: p.amount
            }));

            if (historicalGrowth.length === 0) {
                historicalGrowth.push({ date: new Date().toISOString().split('T')[0], returns: 0 });
            }

            const totalReturnPercentage = user.totalInvested > 0
                ? ((user.totalReturns / user.totalInvested) * 100).toFixed(1)
                : 0;

            const flags = await FeatureFlag.find({ isEnabled: true });
            const featureFlags = {};
            flags.forEach(f => { featureFlags[f.key] = true; });

            // Withdrawal Ticker
            const recentWithdrawals = await Transaction.find({ type: 'Withdrawal', status: 'Completed' })
                .populate('user', 'name')
                .sort({ date: -1 })
                .limit(10);

            let marketData = recentWithdrawals.map(w => {
                const names = w.user?.name?.split(' ') || ['User'];
                const displayName = names.length > 1 ? `${names[0]} ${names[1][0]}.` : names[0];
                const diffMs = new Date() - new Date(w.date);
                const diffMins = Math.floor(diffMs / 60000);
                const timeAgo = diffMins < 1 ? 'JUST NOW' :
                    diffMins < 60 ? `${diffMins}m ago` :
                        `${Math.floor(diffMins / 60)}h ago`;

                return {
                    symbol: displayName,
                    price: `$${Math.abs(w.amount).toLocaleString()}`,
                    change: timeAgo,
                    up: true
                };
            });

            if (marketData.length === 0) {
                marketData = [
                    { symbol: 'Chinedu O.', price: '$850.00', change: 'JUST NOW', up: true },
                    { symbol: 'Sarah A.', price: '$120.00', change: '2m ago', up: true },
                    { symbol: 'David K.', price: '$2,450.00', change: '5m ago', up: true },
                    { symbol: 'Blessing E.', price: '$45.00', change: '8m ago', up: true },
                    { symbol: 'Tunde W.', price: '$1,200.00', change: '15m ago', up: true }
                ];
            }

            res.json({
                totalBalance: user.totalBalance,
                lockedBalance: user.lockedBalance,
                totalInvested: user.totalInvested,
                totalReturns: user.totalReturns,
                activeInvestments: allActiveInvestments,
                recentTransactions: transactions.map(tx => ({
                    ...tx._doc,
                    id: tx._id,
                    date: tx.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                })),
                referrals: {
                    code: user.referralCode || 'N/A',
                    count: user.referralCount || 0,
                    pendingBalance: user.referralBalance || 0,
                    totalEarned: user.lifetimeReferralEarnings || 0,
                    history: referralHistory
                },
                products,
                allocationPercentages,
                historicalGrowth,
                totalReturnPercentage,
                featureFlags,
                marketData
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching dashboard data' });
        }
    },

    getSettings: async (req, res) => {
        try {
            const settings = await Settings.findOne();
            res.json(settings);
        } catch (err) {
            res.status(500).json({ message: 'Error fetching settings' });
        }
    }
};

module.exports = profileController;
