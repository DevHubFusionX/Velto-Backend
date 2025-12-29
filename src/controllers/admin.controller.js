const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');
const Product = require('../models/Product');
const KYC = require('../models/KYC');
const Settings = require('../models/Settings');
const UserInvestment = require('../models/UserInvestment');
const InvestmentPlan = require('../models/InvestmentPlan');
const Payout = require('../models/Payout');
const { triggerManualPayout } = require('../services/payout.scheduler');
const AuditLog = require('../models/AuditLog');
const { logSecurityEvent } = require('../utils/logger');

const adminController = {
    getWithdrawals: async (req, res) => {
        try {
            const withdrawals = await Transaction.find({ type: 'Withdrawal' })
                                                .populate('user', 'name email')
                                                .sort({ date: -1 });
            res.json(withdrawals);
        } catch (err) {
            res.status(500).json({ message: 'Error fetching withdrawals' });
        }
    },



    getStats: async (req, res) => {
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const totalUsers = await User.countDocuments({ role: 'user' });
            const newUsers24h = await User.countDocuments({ role: 'user', createdAt: { $gte: twentyFourHoursAgo } });
            
            const pendingKYC = await KYC.countDocuments({ status: 'Pending' });
            const newKYC24h = await KYC.countDocuments({ submittedAt: { $gte: twentyFourHoursAgo } });
            
            const activeInvestments = await Investment.countDocuments({ status: 'Active' });
            const newInvestments24h = await Investment.countDocuments({ createdAt: { $gte: twentyFourHoursAgo } });
            const investmentsNow = await Investment.find({ status: 'Active' });
            const totalInvested = investmentsNow.reduce((sum, inv) => sum + inv.amount, 0);

            // Calculate Total User Wallets Balance
            const allUsers = await User.find({});
            const totalUserBalance = allUsers.reduce((sum, user) => sum + (user.totalBalance || 0), 0);

            const withdrawals = await Transaction.find({ type: 'Withdrawal', status: 'Pending' });
            const pendingWithAmount = withdrawals.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

            // Dynamic Revenue Breakdown (Investments by category)
            const investmentsByCat = await Investment.aggregate([
                { $match: { status: 'Active' } },
                { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'productDetails' } },
                { $unwind: '$productDetails' },
                { $group: { _id: '$productDetails.type', total: { $sum: '$amount' } } }
            ]);

            const totalActiveValue = investmentsByCat.reduce((sum, item) => sum + item.total, 0);
            const breakdown = investmentsByCat.map(item => ({
                name: item._id,
                value: totalActiveValue > 0 ? Math.round((item.total / totalActiveValue) * 100) : 0,
                color: item._id === 'Real Estate' ? '#a3e635' : item._id === 'Agriculture' ? '#65a30d' : '#84cc16'
            }));
            
            // Dynamic Growth (Investments over selected range)
            const range = req.query.range || 'ALL';
            let startDate = new Date();
            let groupingFormat = "%Y-%m";

            switch (range) {
                case '1W':
                    startDate.setDate(startDate.getDate() - 7);
                    groupingFormat = "%Y-%m-%d";
                    break;
                case '1M':
                    startDate.setDate(startDate.getDate() - 30);
                    groupingFormat = "%Y-%m-%d";
                    break;
                case '1Y':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    groupingFormat = "%Y-%m";
                    break;
                case 'ALL':
                default:
                    startDate = new Date(0);
                    groupingFormat = "%Y-%m";
                    break;
            }

            const growthData = await UserInvestment.aggregate([
                { $match: { startDate: { $gte: startDate } } },
                {
                    $group: {
                        _id: { $dateToString: { format: groupingFormat, date: "$startDate" } },
                        balance: { $sum: "$amount" },
                        returns: { $sum: "$totalPayoutReceived" } 
                    }
                },
                { $sort: { "_id": 1 } }
            ]);

            const growth = growthData.map(item => ({
                date: item._id, 
                balance: item.balance,
                returns: item.returns
            }));

            // Calculate percentage change for KYC (dummy-ish but dynamic based on new/total)
            const kycChange = pendingKYC > 0 ? `+${Math.round((newKYC24h / (pendingKYC || 1)) * 100)}%` : '0%';

            res.json({
                users: {
                    total: totalUsers,
                    totalBalance: totalUserBalance,
                    change: `+${newUsers24h}`,
                    trend: newUsers24h > 0 ? 'up' : 'neutral'
                },
                kyc: {
                    pending: pendingKYC,
                    change: kycChange,
                    trend: newKYC24h > 0 ? 'up' : 'neutral'
                },
                investments: {
                    active: activeInvestments,
                    totalValue: totalInvested,
                    change: `+${newInvestments24h}`,
                    trend: newInvestments24h > 0 ? 'up' : 'neutral'
                },
                withdrawals: {
                    pending: pendingWithAmount,
                    change: `${withdrawals.length} reqs`,
                    trend: withdrawals.length > 0 ? 'up' : 'neutral'
                },
                revenue: {
                    breakdown: breakdown.length > 0 ? breakdown : [
                        { name: 'No Data', value: 100, color: '#3f3f46' }
                    ],
                    growth: growth.length > 0 ? growth : [
                        { date: new Date().toISOString().slice(0, 7), balance: 0, returns: 0 }
                    ]
                }
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching stats' });
        }
    },

    getSystemHealth: async (req, res) => {
        try {
            const settings = await Settings.findOne() || {};
            const isMaintenance = settings.maintenanceMode || false;
            
            // Calculate real session count (roughly) - in a real app this would be in Redis
            const activeSessions = await User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 3600000) } }); // Active in last hour

            res.json({
                status: isMaintenance ? 'Maintenance' : 'Operational',
                latency: `${Math.floor(Math.random() * 20) + 15}ms`,
                uptime: isMaintenance ? '98.5%' : '99.99%',
                lastPatch: '2.4.5',
                threatLevel: settings.failedLoginAttempts > 20 ? 'Elevated' : 'Low',
                failedAttempts: settings.failedLoginAttempts || 0,
                activeSessions: activeSessions || 1,
                protocols: settings.securityProtocols || {
                    enforce2fa: false,
                    ipWhitelisting: false,
                    auditLogsEnabled: true
                }
            });
        } catch (err) {
            res.status(500).json({ message: 'Error fetching health' });
        }
    },

    getLogs: async (req, res) => {
        try {
            const logs = await AuditLog.find()
                                     .populate('user', 'name')
                                     .sort({ timestamp: -1 })
                                     .limit(50);
            
            res.json(logs);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching logs' });
        }
    },

    revokeSession: async (req, res) => {
        try {
            const { userId } = req.params;
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ message: 'User not found' });

            user.sessionRevokedAt = new Date();
            await user.save();

            await logSecurityEvent({
                user: req.user.id,
                action: 'SUSPICIOUS_ACTIVITY',
                details: `Forced session revocation for user: ${user.email}`,
                status: 'warning',
                req
            });

            res.json({ message: 'Session revoked successfully' });
        } catch (err) {
            res.status(500).json({ message: 'Error revoking session' });
        }
    },

    getCurrentIp: async (req, res) => {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        res.json({ ip: clientIp });
    },

    addIpToWhitelist: async (req, res) => {
        try {
            const { ip } = req.body;
            if (!ip) return res.status(400).json({ message: 'IP is required' });

            const settings = await Settings.findOne();
            if (!settings.securityProtocols.ipWhitelist.includes(ip)) {
                settings.securityProtocols.ipWhitelist.push(ip);
                await settings.save();
            }

            await logSecurityEvent({
                user: req.user.id,
                action: 'SETTINGS_UPDATE',
                details: `Added ${ip} to security whitelist`,
                status: 'info',
                req
            });

            res.json({ message: 'IP added to whitelist', whitelist: settings.securityProtocols.ipWhitelist });
        } catch (err) {
            res.status(500).json({ message: 'Error adding IP' });
        }
    },

    removeIpFromWhitelist: async (req, res) => {
        try {
            const { ip } = req.body;
            const settings = await Settings.findOne();
            settings.securityProtocols.ipWhitelist = settings.securityProtocols.ipWhitelist.filter(i => i !== ip);
            await settings.save();

            await logSecurityEvent({
                user: req.user.id,
                action: 'SETTINGS_UPDATE',
                details: `Removed ${ip} from security whitelist`,
                status: 'info',
                req
            });

            res.json({ message: 'IP removed from whitelist', whitelist: settings.securityProtocols.ipWhitelist });
        } catch (err) {
            res.status(500).json({ message: 'Error removing IP' });
        }
    },

    getPendingKYC: async (req, res) => {
        try {
            const kyc = await KYC.find({ status: 'Pending' }).populate('user', 'name email');
            res.json(kyc);
        } catch (err) {
            res.status(500).json({ message: 'Error fetching KYC' });
        }
    },

    approveKYC: async (req, res) => {
        const { kycId } = req.params;
        try {
            const kyc = await KYC.findById(kycId);
            if (!kyc) return res.status(404).json({ message: 'KYC not found' });
            
            kyc.status = 'Approved';
            kyc.approvedAt = new Date();
            await kyc.save();
            res.json({ message: 'KYC Approved', record: kyc });
        } catch (err) {
            res.status(500).json({ message: 'Error approving KYC' });
        }
    },

    rejectKYC: async (req, res) => {
        const { kycId } = req.params;
        try {
            const kyc = await KYC.findById(kycId);
            if (!kyc) return res.status(404).json({ message: 'KYC not found' });
            
            kyc.status = 'Rejected';
            kyc.rejectedAt = new Date();
            await kyc.save();
            res.json({ message: 'KYC Rejected', record: kyc });
        } catch (err) {
            res.status(500).json({ message: 'Error rejecting KYC' });
        }
    },

    toggleSystemMaintenance: async (req, res) => {
        try {
            const settings = await Settings.findOne();
            if (settings) {
                settings.maintenanceMode = !settings.maintenanceMode;
                await settings.save();
                res.json({ 
                    message: `System ${settings.maintenanceMode ? 'frozen' : 'unfrozen'} successfully`,
                    maintenanceMode: settings.maintenanceMode
                });

                await logSecurityEvent({
                    user: req.user.id,
                    action: 'MAINTENANCE_TOGGLE',
                    details: `System ${settings.maintenanceMode ? 'FROZEN' : 'UNFROZEN'} by admin`,
                    status: settings.maintenanceMode ? 'warning' : 'success',
                    req
                });
            } else {
                res.status(404).json({ message: 'Settings not found' });
            }
        } catch (err) {
            res.status(500).json({ message: 'Error toggling maintenance' });
        }
    },

    createInvestmentPlan: async (req, res) => {
        try {
            const { plan } = req.body;
            const newProduct = await Product.create({
                ...plan,
                status: 'active'
            });
            res.json({ message: 'Plan created', plan: newProduct });
        } catch (err) {
            res.status(500).json({ message: 'Error creating plan' });
        }
    },

    getUsers: async (req, res) => {
        try {
            const users = await User.find().select('-password').sort({ createdAt: -1 });
            
            // Fetch all investments and group by user for efficiency
            const investments = await Investment.find({});
            const userInvestments = await UserInvestment.find({});
            const investmentMap = {};
            
            // Helper to aggregate investments
            const aggregate = (list) => {
                list.forEach(inv => {
                    const userId = inv.user?._id || inv.user; // Handle populated vs unpopulated
                    if (!userId) return;
                    
                    if (!investmentMap[userId]) {
                        investmentMap[userId] = { total: 0, active: 0 };
                    }
                    investmentMap[userId].total += inv.amount;
                    if (inv.status === 'Active' || inv.status === 'active') { // Check case sensitivity
                        investmentMap[userId].active += inv.amount;
                    }
                });
            };

            aggregate(investments);
            aggregate(userInvestments);

            const enrichedUsers = await Promise.all(users.map(async (user) => {
                const kyc = await KYC.findOne({ user: user._id });
                const userInvData = investmentMap[user._id] || { total: 0, active: 0 };
                
                return {
                    ...user.toObject(),
                    kycStatus: kyc ? kyc.status : 'Unverified',
                    joinedAt: user.createdAt,
                    totalInvestedCalculated: userInvData.total,
                    activeHoldings: userInvData.active
                };
            }));

            res.json(enrichedUsers);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching users' });
        }
    },

    getProductsWithStats: async (req, res) => {
        try {
            const products = await Product.find();
            
            // Aggregate active investments count per product
            const investmentCounts = await Investment.aggregate([
                { $match: { status: 'Active' } },
                { $group: { _id: '$product', count: { $sum: 1 } } }
            ]);

            // Create a map for O(1) lookups
            const countMap = {};
            investmentCounts.forEach(item => {
                countMap[item._id.toString()] = item.count;
            });

            const productsWithStats = products.map(product => ({
                ...product.toObject(),
                investorCount: countMap[product._id.toString()] || 0,
                // Ensure status exists, default to Active if missing (legacy seed data might miss it)
                status: product.status || 'Active' 
            }));

            res.json(productsWithStats);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching products' });
        }
    },

    // User Management Operations
    getUserDetails: async (req, res) => {
        try {
            const { userId } = req.params;
            const user = await User.findById(userId).select('-password');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const kyc = await KYC.findOne({ user: userId });
            const investments = await Investment.find({ user: userId });
            const transactions = await Transaction.find({ user: userId }).sort({ date: -1 }).limit(10);

            res.json({
                ...user.toObject(),
                kycStatus: kyc ? kyc.status : 'Unverified',
                kycDetails: kyc,
                totalInvestments: investments.length,
                activeInvestments: investments.filter(i => i.status === 'Active').length,
                recentTransactions: transactions
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching user details' });
        }
    },

    updateUserBalance: async (req, res) => {
        try {
            const { userId } = req.params;
            const { amount, type, reason } = req.body; // type: 'add' or 'deduct'

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const numAmount = parseFloat(amount);
            if (type === 'add') {
                user.totalBalance += numAmount;
            } else if (type === 'deduct') {
                if (user.totalBalance < numAmount) {
                    return res.status(400).json({ message: 'Insufficient balance' });
                }
                user.totalBalance -= numAmount;
            }

            await user.save();

            // Create transaction record
            await Transaction.create({
                user: userId,
                type: type === 'add' ? 'Deposit' : 'Withdrawal',
                amount: type === 'add' ? numAmount : -numAmount,
                status: 'Completed',
                reference: `ADMIN-${type.toUpperCase()}-${Date.now()}`,
                description: reason || `Admin ${type} balance`
            });

            res.json({ message: 'Balance updated successfully', newBalance: user.totalBalance });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error updating balance' });
        }
    },

    suspendUser: async (req, res) => {
        try {
            const { userId } = req.params;
            const { reason } = req.body;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Add a suspended flag to user
            user.suspended = true;
            user.suspendedAt = new Date();
            user.suspensionReason = reason || 'Administrative action';
            await user.save();

            res.json({ message: 'User suspended successfully', user });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error suspending user' });
        }
    },

    activateUser: async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            user.suspended = false;
            user.suspendedAt = null;
            user.suspensionReason = null;
            await user.save();

            res.json({ message: 'User activated successfully', user });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error activating user' });
        }
    },

    deleteUser: async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Delete related data
            await KYC.deleteMany({ user: userId });
            await Investment.deleteMany({ user: userId });
            await Transaction.deleteMany({ user: userId });
            await user.deleteOne();

            res.json({ message: 'User and related data deleted successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error deleting user' });
        }
    },

    // Investment Analytics
    getInvestmentAnalytics: async (req, res) => {
        try {
            // Total investments locked
            const activeInvestments = await UserInvestment.find({ status: 'active' });
            const totalLocked = activeInvestments.reduce((sum, inv) => sum + inv.amount, 0);

            // Total payouts distributed
            const allPayouts = await Payout.find({});
            const totalPaid = allPayouts.reduce((sum, p) => sum + p.amount, 0);

            // Counts
            const activeCount = activeInvestments.length;
            const completedCount = await UserInvestment.countDocuments({ status: 'completed' });
            const terminatedCount = await UserInvestment.countDocuments({ status: 'terminated' });

            // Investment distribution by plan
            const distributionPipeline = [
                { $match: { status: 'active' } },
                { $group: { _id: '$plan', total: { $sum: '$amount' }, count: { $sum: 1 } } },
                { $lookup: { from: 'investmentplans', localField: '_id', foreignField: '_id', as: 'planDetails' } },
                { $unwind: '$planDetails' },
                { $project: { planName: '$planDetails.name', total: 1, count: 1 } }
            ];
            const distribution = await UserInvestment.aggregate(distributionPipeline);

            // Recent payouts
            const recentPayouts = await Payout.find({})
                .populate('user', 'name email')
                .populate('investment')
                .sort({ date: -1 })
                .limit(20);

            res.json({
                totalLocked,
                totalPaid,
                activeCount,
                completedCount,
                terminatedCount,
                distribution,
                recentPayouts
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching investment analytics' });
        }
    },

    // Manual Payout Trigger
    triggerPayouts: async (req, res) => {
        try {
            await triggerManualPayout();
            res.json({ message: 'Payout process triggered successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error triggering payouts' });
        }
    },

    // Get Payout Logs
    getPayoutLogs: async (req, res) => {
        try {
            const { limit = 100 } = req.query;
            const logs = await Payout.find({})
                .populate('user', 'name email')
                .populate('investment', 'amount plan')
                .sort({ date: -1 })
                .limit(parseInt(limit));

            res.json(logs);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching payout logs' });
        }
    },

    // Approve Withdrawal
    approveWithdrawal: async (req, res) => {
        try {
            const { transactionId } = req.params;

            const transaction = await Transaction.findById(transactionId).populate('user');
            if (!transaction) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            if (transaction.status !== 'Pending') {
                return res.status(400).json({ message: 'Transaction already processed' });
            }

            // Release locked funds and complete withdrawal
            const user = await User.findById(transaction.user._id);
            user.lockedBalance -= Math.abs(transaction.amount);
            await user.save();

            // Update transaction status
            transaction.status = 'Completed';
            await transaction.save();

            res.json({ message: 'Withdrawal approved and released', transaction });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error releasing withdrawal' });
        }
    },

    // Reject Withdrawal
    rejectWithdrawal: async (req, res) => {
        try {
            const { transactionId } = req.params;
            const { reason } = req.body;

            const transaction = await Transaction.findById(transactionId).populate('user');
            if (!transaction) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            if (transaction.status !== 'Pending') {
                return res.status(400).json({ message: 'Transaction already processed' });
            }

            // Return locked funds to available balance
            const user = await User.findById(transaction.user._id);
            user.lockedBalance -= Math.abs(transaction.amount);
            user.totalBalance += Math.abs(transaction.amount);
            await user.save();

            // Update transaction status
            transaction.status = 'Rejected';
            transaction.description = `${transaction.description} - Rejected: ${reason || 'Administrative decision'}`;
            await transaction.save();

            res.json({ message: 'Withdrawal rejected and funds returned', transaction });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error rejecting withdrawal' });
        }
    },

    // Get Pending Deposits
    getDeposits: async (req, res) => {
        try {
            const deposits = await Transaction.find({ 
                type: 'Deposit'
            }).populate('user', 'name email').sort({ date: -1 });

            res.json(deposits);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching pending deposits' });
        }
    },

    // Approve Deposit (Stage 3: Verification)
    approveDeposit: async (req, res) => {
        try {
            const { transactionId } = req.params;
            const { verifiedAmount } = req.body; // Amount Verification

            const transaction = await Transaction.findById(transactionId).populate('user');
            if (!transaction) {
                return res.status(404).json({ message: 'Deposit not found' });
            }

            if (transaction.status !== 'Pending') {
                return res.status(400).json({ message: 'Deposit already processed' });
            }

            // Trust verified amount if provided, otherwise fallback to original request (but warned)
            const finalAmount = verifiedAmount !== undefined ? parseFloat(verifiedAmount) : transaction.amount;
            
            // Update Transaction
            transaction.amount = finalAmount; // Update to actual received amount
            transaction.status = 'Completed';
            transaction.description = `${transaction.description} - Verified & Approved by Admin`;
            transaction.verifiedAt = new Date();
            transaction.verifiedBy = req.user.id;
            await transaction.save();

            // Credit User Balance
            const user = await User.findById(transaction.user._id);
            user.totalBalance += finalAmount;
            await user.save();

            // Log security event
            await logSecurityEvent({
                user: req.user.id,
                action: 'DEPOSIT_APPROVAL',
                details: `Approved deposit ${transaction.reference} for amount ${finalAmount}`,
                status: 'success',
                req
            });

            res.json({ message: 'Deposit approved and credited', transaction });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error approving deposit' });
        }
    },

    // Reject Deposit
    rejectDeposit: async (req, res) => {
        try {
            const { transactionId } = req.params;
            const { reason } = req.body;

            const transaction = await Transaction.findById(transactionId).populate('user');
            if (!transaction) {
                return res.status(404).json({ message: 'Deposit not found' });
            }

            if (transaction.status !== 'Pending') {
                return res.status(400).json({ message: 'Deposit already processed' });
            }

            // Update transaction status
            transaction.status = 'Rejected';
            transaction.description = `${transaction.description} - Rejected: ${reason || 'Invalid payment'}`;
            await transaction.save();

            res.json({ message: 'Deposit rejected', transaction });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error rejecting deposit' });
        }
    },

    // Settings Management
    getSettings: async (req, res) => {
        try {
            let settings = await Settings.findOne();
            if (!settings) {
                settings = await Settings.create({
                    maintenanceMode: false,
                    limits: {
                        deposit: {
                            min: { usd: 100, ngn: 100000 },
                            max: { usd: 100000, ngn: 100000000 }
                        },
                        withdrawal: {
                            min: { usd: 50, ngn: 50000 },
                            max: { usd: 50000, ngn: 50000000 }
                        }
                    },
                    referral: {
                        rewardPercent: 3,
                        maxRewardPerReferral: 5000,
                        maxReferralsLifetime: 50,
                        maxEarningsLifetime: 100000,
                        unlockDays: 14,
                        activeInvestmentRequired: true
                    },
                    referralBonus: 2500, // Fixed NGN
                    updatedAt: Date.now()
                });
            } else if (!settings.referral) {
                // Migrate existing settings if referral block is missing
                settings.referral = {
                    rewardPercent: 3,
                    maxRewardPerReferral: 5000,
                    maxReferralsLifetime: 50,
                    maxEarningsLifetime: 100000,
                    unlockDays: 14,
                    activeInvestmentRequired: true
                };
                await settings.save();
            }
            res.json(settings);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching settings' });
        }
    },

    updateSettings: async (req, res) => {
        try {
            const settings = await Settings.findOneAndUpdate({}, req.body, {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            });
            await logSecurityEvent({
                user: req.user.id,
                action: 'SETTINGS_UPDATE',
                details: `Platform settings updated`,
                status: 'info',
                req
            });
            res.json({ message: 'Settings updated successfully', settings });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error updating settings' });
        }
    }
};

module.exports = adminController;
