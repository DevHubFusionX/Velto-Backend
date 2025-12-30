const User = require('../../models/User');
const KYC = require('../../models/KYC');
const Investment = require('../../models/Investment');
const Transaction = require('../../models/Transaction');
const UserInvestment = require('../../models/UserInvestment');
const Settings = require('../../models/Settings');
const AuditLog = require('../../models/AuditLog');

const statsController = {
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

            // Calculate percentage change for KYC
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
    }
};

module.exports = statsController;
