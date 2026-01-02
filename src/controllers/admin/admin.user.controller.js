const User = require('../../models/User');
const KYC = require('../../models/KYC');
const Investment = require('../../models/Investment');
const Transaction = require('../../models/Transaction');
const UserInvestment = require('../../models/UserInvestment');
const { logSecurityEvent } = require('../../utils/logger');

const userController = {
    getUsers: async (req, res) => {
        try {
            const users = await User.find().select('-password').sort({ createdAt: -1 });

            const investments = await Investment.find({});
            const userInvestments = await UserInvestment.find({});
            const investmentMap = {};

            const aggregate = (list) => {
                list.forEach(inv => {
                    const userId = inv.user?._id || inv.user;
                    if (!userId) return;

                    if (!investmentMap[userId]) {
                        investmentMap[userId] = { total: 0, active: 0 };
                    }
                    investmentMap[userId].total += inv.amount;
                    if (inv.status === 'Active' || inv.status === 'active') {
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

            const totalInvestedValue = investments.reduce((sum, inv) => sum + inv.amount, 0);
            const activeInvestedValue = investments
                .filter(i => i.status === 'Active' || i.status === 'active')
                .reduce((sum, inv) => sum + inv.amount, 0);

            res.json({
                ...user.toObject(),
                kycStatus: kyc ? kyc.status : 'Unverified',
                kycDetails: kyc,
                totalInvestmentsCount: investments.length,
                activeInvestmentsCount: investments.filter(i => i.status === 'Active' || i.status === 'active').length,
                totalInvestedValue,
                activeInvestedValue,
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
            const { amount, type, reason } = req.body;

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
    }
};

module.exports = userController;
