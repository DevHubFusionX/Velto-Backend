const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const Settings = require('../../models/Settings');
const { sendNotification, sendAdminNotification } = require('../../utils/notification');

const financeController = {
    deposit: async (req, res) => {
        try {
            console.log('Deposit Request Body:', req.body);
            const { amount, method, currency, proofUrl } = req.body;
            const numAmount = parseFloat(amount);

            const settings = await Settings.findOne();
            if (!settings || !settings.limits || !settings.limits.deposit) {
                console.error('Deposit limits not found in settings');
                return res.status(500).json({ message: 'System configuration error: limits not found' });
            }

            const limits = settings.limits.deposit;
            const min = currency === 'USD' ? limits.min.usd : limits.min.ngn;
            const max = currency === 'USD' ? limits.max.usd : limits.max.ngn;

            console.log(`Deposit Validation: Amount=${numAmount}, Currency=${currency}, Min=${min}, Max=${max}`);

            if (numAmount < min) {
                return res.status(400).json({ message: `Minimum deposit is ${min}` });
            }
            if (numAmount > max) {
                return res.status(400).json({ message: `Maximum deposit is ${max}` });
            }

            const user = await User.findById(req.user.id);

            const transaction = await Transaction.create({
                user: user._id,
                type: 'Deposit',
                amount: numAmount,
                requestedAmount: numAmount,
                currency,
                status: 'Pending',
                reference: `DEP-${Date.now()}`,
                method,
                description: `Deposit via ${method} - Awaiting confirmation`,
                proofUrl
            });

            await sendNotification(
                user._id,
                'Deposit Initiated',
                `Your deposit request for ${numAmount} ${currency} has been received and is awaiting verification.`,
                'deposit',
                'normal',
                { transactionId: transaction._id }
            );

            await sendAdminNotification(
                'New Deposit Pending',
                `User ${user.email} initiated a deposit of ${numAmount} ${currency}.`,
                'admin',
                'normal',
                { transactionId: transaction._id, userId: user._id }
            );

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

            const transaction = await Transaction.create({
                user: user._id,
                type: 'Withdrawal',
                amount: -numAmount,
                currency,
                status: 'Pending',
                reference: `WTH-${Date.now()}`,
                method: 'Bank Transfer',
                description: `Withdrawal to ${bankDetails.bankName} - ${bankDetails.accountNumber}`
            });

            user.totalBalance -= numAmount;
            user.lockedBalance += numAmount;
            await user.save();

            await sendNotification(
                user._id,
                'Withdrawal Requested',
                `Your withdrawal request for ${numAmount} ${currency} has been submitted.`,
                'withdrawal',
                'high',
                { transactionId: transaction._id }
            );

            await sendAdminNotification(
                'New Withdrawal Request',
                `User ${user.email} requested a withdrawal of ${numAmount} ${currency}.`,
                'admin',
                'high',
                { transactionId: transaction._id, userId: user._id }
            );

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
    }
};

module.exports = financeController;
