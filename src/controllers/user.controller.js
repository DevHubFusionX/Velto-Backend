const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const InvestmentPlan = require('../models/InvestmentPlan');
const UserInvestment = require('../models/UserInvestment');
const Payout = require('../models/Payout');
const FeatureFlag = require('../models/FeatureFlag');

const userController = {
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
                planName: inv.productName || 'Investment', // Normalize name
                type: 'Legacy'
            }));

            const mappedNewInvestments = userInvestments.map(inv => {
                const maturityDate = new Date(inv.endDate);
                return {
                    ...inv._doc,
                    id: inv._id,
                    productName: inv.plan?.name || 'Investment Plan', // Provide productName compatibility
                    planName: inv.plan?.name || 'Investment Plan',
                    amount: inv.amount,
                    currency: 'USD', // Default or fetch from somewhere
                    currentValue: inv.amount, // Or calculate based on dailyPayout
                    roiPercent: (inv.plan?.dailyPayout || 0) * (inv.plan?.durationDays || 30), // Approx ROI
                    startDate: inv.startDate.toISOString().split('T')[0],
                    maturityDate: maturityDate.toISOString().split('T')[0],
                    status: 'Active', // Normalize 'active' to 'Active' for frontend consistency
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

            // Referral History (Last 5 referred users)
            const recentlyReferred = await User.find({ referredBy: req.user.id })
                .sort({ joinDate: -1 })
                .limit(5);
            
            const referralHistory = await Promise.all(recentlyReferred.map(async (ref) => {
                // Check if this referral has generated a bonus
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

            // Fetch Active Investment Plans (Products)
            const plans = await InvestmentPlan.find({ status: 'active' });
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

            // --- Performance Analytics Calculations ---
            
            // 1. Asset Allocation (based on active investments)
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

            // 2. Historical Growth (based on last 6 payouts)
            const recentPayouts = await Payout.find({ user: req.user.id, type: 'daily' })
                .sort({ date: -1 })
                .limit(6);

            const historicalGrowth = recentPayouts.reverse().map(p => ({
                date: p.date.toISOString().split('T')[0],
                returns: p.amount
            }));

            // Fallback for growth chart if no payouts yet to avoid empty graph
            if (historicalGrowth.length === 0) {
                historicalGrowth.push({ date: new Date().toISOString().split('T')[0], returns: 0 });
            }

            // 3. Overall Return Percentage
            const totalReturnPercentage = user.totalInvested > 0 
                ? ((user.totalReturns / user.totalInvested) * 100).toFixed(1) 
                : 0;

            // 4. Feature Flags
            const flags = await FeatureFlag.find({ isEnabled: true });
            const featureFlags = {};
            flags.forEach(f => {
                featureFlags[f.key] = true;
            });

            // 5. Live Withdrawal Ticker Data (Replacing Market Data)
            const recentWithdrawals = await Transaction.find({ type: 'Withdrawal', status: 'Completed' })
                .populate('user', 'name')
                .sort({ date: -1 })
                .limit(10);

            let marketData = recentWithdrawals.map(w => {
                const names = w.user?.name?.split(' ') || ['User'];
                const displayName = names.length > 1 ? `${names[0]} ${names[1][0]}.` : names[0];
                
                // Simple relative time
                const diffMs = new Date() - new Date(w.date);
                const diffMins = Math.floor(diffMs / 60000);
                const timeAgo = diffMins < 1 ? 'JUST NOW' : 
                               diffMins < 60 ? `${diffMins}m ago` : 
                               `${Math.floor(diffMins/60)}h ago`;

                return {
                    symbol: displayName,
                    price: `₦${Math.abs(w.amount).toLocaleString()}`,
                    change: timeAgo,
                    up: true
                };
            });

            // Professional Mock Data Fallback if no withdrawals yet
            if (marketData.length === 0) {
                marketData = [
                    { symbol: 'Chinedu O.', price: '₦150,000', change: 'JUST NOW', up: true },
                    { symbol: 'Sarah A.', price: '₦85,000', change: '2m ago', up: true },
                    { symbol: 'David K.', price: '₦220,000', change: '5m ago', up: true },
                    { symbol: 'Blessing E.', price: '₦12,500', change: '8m ago', up: true },
                    { symbol: 'Tunde W.', price: '₦410,000', change: '15m ago', up: true }
                ];
            }

            // Construct dashboard response
            const dashboardData = {
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
            };
            
            res.json(dashboardData);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching dashboard data' });
        }
    },

    getNotifications: async (req, res) => {
        // Mock notification logic for now or implement Notification model later
        res.json([]);
    },

    markNotificationRead: async (req, res) => {
        res.json({ message: 'Notification marked as read' });
    },

    getSettings: async (req, res) => {
        try {
            const settings = await Settings.findOne();
            res.json(settings);
        } catch (err) {
            res.status(500).json({ message: 'Error fetching settings' });
        }
    },

    deposit: async (req, res) => {
        try {
            console.log('Deposit Request Body:', req.body);
            const { amount, method, currency, proofUrl } = req.body;
            const numAmount = parseFloat(amount);

            const settings = await Settings.findOne();
            // Check if settings or limits exist
            if (!settings || !settings.limits || !settings.limits.deposit) {
                 console.error('Deposit limits not found in settings');
                 // Fallback or error? For debugging, let's error
                 return res.status(500).json({ message: 'System configuration error: limits not found' });
            }

            const limits = settings.limits.deposit;
            const min = currency === 'USD' ? limits.min.usd : limits.min.ngn;
            const max = currency === 'USD' ? limits.max.usd : limits.max.ngn;
            
            console.log(`Deposit Validation: Amount=${numAmount}, Currency=${currency}, Min=${min}, Max=${max}`);

            if (numAmount < min) {
                console.log('Deposit failed: Below minimum');
                return res.status(400).json({ message: `Minimum deposit is ${min}` });
            }
            if (numAmount > max) {
                 console.log('Deposit failed: Above maximum');
                return res.status(400).json({ message: `Maximum deposit is ${max}` });
            }

            const user = await User.findById(req.user.id);
            
            // Create Transaction with Pending status
            // Stage 1: Initiation
            const transaction = await Transaction.create({
                user: user._id,
                type: 'Deposit',
                amount: numAmount,
                requestedAmount: numAmount, // Store original request
                currency,
                status: 'Pending', 
                reference: `DEP-${Date.now()}`,
                method,
                description: `Deposit via ${method} - Awaiting confirmation`,
                proofUrl // Stage 2: Confirmation (if provided immediately)
            });

            // Do NOT update balance yet. Waiting for Stage 3 (Verification)

            res.json({
                message: 'Deposit request submitted. Awaiting confirmation.',
                transaction,
                status: 'pending'
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error processing deposit' });
        }
    },

    withdraw: async (req, res) => {
        const { amount, bankDetails, currency } = req.body;
        const numAmount = parseFloat(amount);

        try {
            const user = await User.findById(req.user.id);
            const settings = await Settings.findOne();
            const limits = settings.limits.withdrawal;
            const min = currency === 'USD' ? limits.min.usd : limits.min.ngn;

            if (numAmount < min) {
                return res.status(400).json({ message: `Minimum withdrawal is ${min}` });
            }
            if (numAmount > user.totalBalance) {
                return res.status(400).json({ message: 'Insufficient funds' });
            }

            // Create Transaction
            const transaction = await Transaction.create({
                user: user._id,
                type: 'Withdrawal',
                amount: -numAmount, // Negative for withdrawal
                currency,
                status: 'Pending',
                reference: `WTH-${Date.now()}`,
                method: 'Bank Transfer',
                description: `Withdrawal to ${bankDetails.bankName} - ${bankDetails.accountNumber}`
            });

            // Lock Funds
            user.totalBalance -= numAmount;
            user.lockedBalance += numAmount;
            await user.save();

            res.json({
                message: 'Withdrawal request submitted',
                newBalance: user.totalBalance
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error processing withdrawal' });
        }
    },

    getTransactions: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            const { type, search } = req.query;

            const query = { user: req.user.id };
            
            if (type && type !== 'all') {
                query.type = type;
            }

            if (search) {
                query.$or = [
                    { reference: { $regex: search, $options: 'i' } },
                    { method: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            const total = await Transaction.countDocuments(query);
            const transactions = await Transaction.find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit);

            const normalizedTransactions = transactions.map(tx => ({
                ...tx._doc,
                id: tx._id,
                date: tx.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            }));

            res.json({
                success: true,
                data: normalizedTransactions,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching transactions' });
        }
    },

    invest: async (req, res) => {
        console.log('--- INVEST CALLED ---');
        const { productId, amount, currency } = req.body;
        const numAmount = parseFloat(amount);

        try {
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).json({ message: 'User not found' });

            if (numAmount > user.totalBalance) {
                return res.status(400).json({ message: 'Insufficient balance' });
            }

            // 1. Try Legacy Product
            let product = null;
            try {
                product = await Product.findById(productId);
            } catch (e) {
                // Ignore cast error if productId is not valid for Product but might be for Plan (though they are both ObjectIds)
            }
            
            if (product) {
                 // --- LEGACY FLOW ---
                 const startDate = new Date();
                 const maturityDate = new Date(startDate.getTime() + (product.durationDays || 365) * 24 * 60 * 60 * 1000);

                 const investment = await Investment.create({
                     user: user._id,
                     product: product._id,
                     productName: product.name,
                     amount: numAmount,
                     currency,
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
                    currency,
                    status: 'Completed',
                    reference: `INV-${Date.now()}`,
                    description: `Investment in ${product.name}`
                });

                user.totalBalance -= numAmount;
                user.totalInvested += numAmount;
                await user.save();

                // --- REFERRAL BONUS LOGIC ---
                if (user.referredBy) {
                    const totalInvestments = (await Investment.countDocuments({ user: user._id })) + 
                                           (await UserInvestment.countDocuments({ user: user._id }));
                    
                    if (totalInvestments === 1) {
                        const referrer = await User.findById(user.referredBy);
                        if (referrer) {
                            const bonusAmount = 2500;
                            referrer.totalBalance += bonusAmount;
                            await referrer.save();

                            await Transaction.create({
                                user: referrer._id,
                                type: 'Referral',
                                amount: bonusAmount,
                                status: 'Completed',
                                reference: `REF-BONUS-LEGACY-${user._id}-${Date.now()}`,
                                description: `Referral bonus for ${user.name}'s first investment`
                            });
                        }
                    }
                }

                return res.json({
                    message: 'Investment successful',
                    newBalance: user.totalBalance,
                    investment
                });
            }

            // 2. Try New Investment Plan
            const plan = await InvestmentPlan.findById(productId); // productId passed is actually planId
            
            if (plan) {
                // --- NEW SYSTEM FLOW ---
                if (numAmount < plan.minAmount || numAmount > plan.maxAmount) {
                     return res.status(400).json({ message: `Amount must be between ${plan.minAmount} and ${plan.maxAmount}` });
                }

                // Calculate daily payout
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
                    reference: `INV-NEW-${investment._id}`,
                    description: `Investment in plan: ${plan.name}`
                });

                user.totalBalance -= numAmount;
                user.totalInvested += numAmount;
                await user.save();

                // --- REFERRAL BONUS LOGIC ---
                if (user.referredBy) {
                    const totalInvestments = (await Investment.countDocuments({ user: user._id })) + 
                                           (await UserInvestment.countDocuments({ user: user._id }));
                    
                    // If this is the only one (it was just created), it's the first one
                    if (totalInvestments === 1) {
                        const referrer = await User.findById(user.referredBy);
                        if (referrer) {
                            const bonusAmount = 2500; // Fixed bonus as per UI
                            referrer.totalBalance += bonusAmount;
                            await referrer.save();

                            await Transaction.create({
                                user: referrer._id,
                                type: 'Referral',
                                amount: bonusAmount,
                                status: 'Completed',
                                reference: `REF-BONUS-${user._id}-${Date.now()}`,
                                description: `Referral bonus for ${user.name}'s first investment`
                            });
                        }
                    }
                }

                return res.json({
                    message: 'Investment successful',
                    newBalance: user.totalBalance,
                    investment
                });
            }

            return res.status(404).json({ message: 'Product/Plan not found' });

        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error processing investment' });
        }
    },

    // Early Investment Withdrawal
    withdrawInvestment: async (req, res) => {
        try {
            const { investmentId } = req.params;
            const userId = req.user.id;

            const investment = await UserInvestment.findOne({ _id: investmentId, user: userId });
            if (!investment) {
                return res.status(404).json({ message: 'Investment not found' });
            }

            if (investment.status !== 'active') {
                return res.status(400).json({ message: 'Investment is not active' });
            }

            // Calculate 10% penalty
            const penaltyAmount = investment.amount * 0.10;
            const returnAmount = investment.amount - penaltyAmount;

            // Update user balance
            const user = await User.findById(userId);
            user.totalBalance += returnAmount;
            await user.save();

            // Update investment status
            investment.status = 'terminated';
            investment.terminatedAt = new Date();
            investment.terminationReason = 'Early withdrawal by user';
            investment.penaltyAmount = penaltyAmount;
            await investment.save();

            // Create payout record
            await Payout.create({
                user: userId,
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
            console.error(err);
            res.status(500).json({ message: 'Error processing withdrawal' });
        }
    },

    // Get Payout History
    getPayoutHistory: async (req, res) => {
        try {
            const userId = req.user.id;
            const { limit = 50, skip = 0 } = req.query;

            const payouts = await Payout.find({ user: userId })
                .populate('investment', 'amount plan')
                .sort({ date: -1 })
                .limit(parseInt(limit))
                .skip(parseInt(skip));

            const total = await Payout.countDocuments({ user: userId });

            // Enrich payout data
            const enrichedPayouts = await Promise.all(payouts.map(async (payout) => {
                let planName = 'N/A';
                if (payout.investment && payout.investment.plan) {
                    const inv = await UserInvestment.findById(payout.investment._id).populate('plan');
                    planName = inv?.plan?.name || 'Investment Plan';
                }

                return {
                    id: payout._id,
                    amount: payout.amount,
                    type: payout.type,
                    date: payout.date,
                    planName,
                    notes: payout.notes
                };
            }));

            res.json({
                success: true,
                data: enrichedPayouts,
                total,
                hasMore: (skip + payouts.length) < total
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching payout history' });
        }
    }
};

module.exports = userController;
