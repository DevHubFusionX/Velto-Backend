const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const { sendNotification } = require('../../utils/notification');
const { logSecurityEvent } = require('../../utils/logger');

const transactionController = {
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

            const user = await User.findById(transaction.user._id);
            user.lockedBalance -= Math.abs(transaction.amount);
            await user.save();

            transaction.status = 'Completed';
            await transaction.save();

            await sendNotification(
                transaction.user._id,
                'Withdrawal Processed',
                `Your withdrawal of ${Math.abs(transaction.amount)} ${transaction.currency} has been approved and processed.`,
                'success',
                'high',
                { transactionId: transaction._id }
            );

            res.json({ message: 'Withdrawal approved and released', transaction });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error releasing withdrawal' });
        }
    },

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

            const user = await User.findById(transaction.user._id);
            user.lockedBalance -= Math.abs(transaction.amount);
            user.totalBalance += Math.abs(transaction.amount);
            await user.save();

            transaction.status = 'Rejected';
            transaction.description = `${transaction.description} - Rejected: ${reason || 'Administrative decision'}`;
            await transaction.save();

            await sendNotification(
                user._id,
                'Withdrawal Rejected',
                `Your withdrawal of ${Math.abs(transaction.amount)} ${transaction.currency} was rejected. Reason: ${reason || 'Administrative decision'}`,
                'warning',
                'high',
                { transactionId: transaction._id }
            );

            res.json({ message: 'Withdrawal rejected and funds returned', transaction });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error rejecting withdrawal' });
        }
    },

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

    approveDeposit: async (req, res) => {
        try {
            const { transactionId } = req.params;
            const { verifiedAmount } = req.body;

            const transaction = await Transaction.findById(transactionId).populate('user');
            if (!transaction) {
                return res.status(404).json({ message: 'Deposit not found' });
            }

            if (transaction.status !== 'Pending') {
                return res.status(400).json({ message: 'Deposit already processed' });
            }

            const finalAmount = verifiedAmount !== undefined ? parseFloat(verifiedAmount) : transaction.amount;

            transaction.amount = finalAmount;
            transaction.status = 'Completed';
            transaction.description = `${transaction.description} - Verified & Approved by Admin`;
            transaction.verifiedAt = new Date();
            transaction.verifiedBy = req.user.id;
            await transaction.save();

            const user = await User.findById(transaction.user._id);
            user.totalBalance += finalAmount;
            await user.save();

            await logSecurityEvent({
                user: req.user.id,
                action: 'DEPOSIT_APPROVAL',
                details: `Approved deposit ${transaction.reference} for amount ${finalAmount}`,
                status: 'success',
                req
            });

            await sendNotification(
                user._id,
                'Deposit Confirmed',
                `Your deposit of ${finalAmount} ${transaction.currency} has been verified and credited to your wallet.`,
                'success',
                'high',
                { transactionId: transaction._id }
            );

            res.json({ message: 'Deposit approved and credited', transaction });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error approving deposit' });
        }
    },

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

            transaction.status = 'Rejected';
            transaction.description = `${transaction.description} - Rejected: ${reason || 'Invalid payment'}`;
            await transaction.save();

            await sendNotification(
                transaction.user._id,
                'Deposit Rejected',
                `Your deposit request has been rejected. Reason: ${reason || 'Invalid payment'}`,
                'warning',
                'high',
                { transactionId: transaction._id }
            );

            res.json({ message: 'Deposit rejected', transaction });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error rejecting deposit' });
        }
    }
};

module.exports = transactionController;
