const CryptoWallet = require('../../models/CryptoWallet');
const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const UserCryptoWallet = require('../../models/UserCryptoWallet');
const { sendNotification } = require('../../utils/notification');
const { logSecurityEvent } = require('../../utils/logger');

const adminCryptoController = {
    // --- Admin Wallet Management ---

    getAdminWallets: async (req, res) => {
        try {
            const wallets = await CryptoWallet.find().sort({ currency: 1 });
            res.json(wallets);
        } catch (err) {
            console.error('Error fetching admin wallets:', err);
            res.status(500).json({ message: 'Error fetching crypto wallets' });
        }
    },

    createWallet: async (req, res) => {
        try {
            const { currency, address, network, label } = req.body;

            const existingWallet = await CryptoWallet.findOne({ address });
            if (existingWallet) {
                return res.status(400).json({ message: 'Wallet address already exists' });
            }

            const wallet = await CryptoWallet.create({
                currency,
                address,
                network,
                label: label || `${currency} Wallet`
            });

            await logSecurityEvent({
                user: req.user.id,
                action: 'CRYPTO_WALLET_CREATED',
                details: `Created ${currency} wallet: ${address.substring(0, 10)}...`,
                status: 'success',
                req
            });

            res.status(201).json(wallet);
        } catch (err) {
            console.error('Error creating wallet:', err);
            res.status(500).json({ message: 'Error creating crypto wallet' });
        }
    },

    updateWallet: async (req, res) => {
        try {
            const { id } = req.params;
            const { address, label, isActive } = req.body;

            const wallet = await CryptoWallet.findById(id);
            if (!wallet) {
                return res.status(404).json({ message: 'Wallet not found' });
            }

            if (address) wallet.address = address;
            if (label !== undefined) wallet.label = label;
            if (isActive !== undefined) wallet.isActive = isActive;
            wallet.updatedAt = Date.now();

            await wallet.save();

            await logSecurityEvent({
                user: req.user.id,
                action: 'CRYPTO_WALLET_UPDATED',
                details: `Updated ${wallet.currency} wallet`,
                status: 'success',
                req
            });

            res.json(wallet);
        } catch (err) {
            console.error('Error updating wallet:', err);
            res.status(500).json({ message: 'Error updating crypto wallet' });
        }
    },

    deleteWallet: async (req, res) => {
        try {
            const { id } = req.params;

            const wallet = await CryptoWallet.findByIdAndDelete(id);
            if (!wallet) {
                return res.status(404).json({ message: 'Wallet not found' });
            }

            await logSecurityEvent({
                user: req.user.id,
                action: 'CRYPTO_WALLET_DELETED',
                details: `Deleted ${wallet.currency} wallet`,
                status: 'success',
                req
            });

            res.json({ message: 'Wallet deleted successfully' });
        } catch (err) {
            console.error('Error deleting wallet:', err);
            res.status(500).json({ message: 'Error deleting crypto wallet' });
        }
    },

    // --- Crypto Transaction Management ---

    getCryptoDeposits: async (req, res) => {
        try {
            const deposits = await Transaction.find({
                type: 'Deposit',
                isCrypto: true
            }).populate('user', 'name email').sort({ date: -1 });

            res.json(deposits);
        } catch (err) {
            console.error('Error fetching crypto deposits:', err);
            res.status(500).json({ message: 'Error fetching crypto deposits' });
        }
    },

    approveCryptoDeposit: async (req, res) => {
        try {
            const { transactionId } = req.params;
            const { verifiedAmount, verifiedTxHash } = req.body;

            const transaction = await Transaction.findById(transactionId).populate('user');
            if (!transaction) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            if (transaction.status !== 'Pending') {
                return res.status(400).json({ message: 'Transaction already processed' });
            }

            const finalAmount = verifiedAmount !== undefined ? parseFloat(verifiedAmount) : transaction.amount;

            transaction.amount = finalAmount;
            transaction.status = 'Completed';
            transaction.txHash = verifiedTxHash || transaction.txHash;
            transaction.description = `${transaction.description} - Verified & Approved`;
            transaction.verifiedAt = new Date();
            transaction.verifiedBy = req.user.id;
            await transaction.save();

            const user = await User.findById(transaction.user._id);
            user.totalBalance += finalAmount;
            await user.save();

            await logSecurityEvent({
                user: req.user.id,
                action: 'CRYPTO_DEPOSIT_APPROVED',
                details: `Approved crypto deposit ${transaction.reference} for $${finalAmount}`,
                status: 'success',
                req
            });

            await sendNotification(
                user._id,
                'Crypto Deposit Confirmed',
                `Your ${transaction.cryptoCurrency} deposit of $${finalAmount} has been verified and credited.`,
                'success',
                'high',
                { transactionId: transaction._id }
            );

            res.json({ message: 'Crypto deposit approved', transaction });
        } catch (err) {
            console.error('Error approving crypto deposit:', err);
            res.status(500).json({ message: 'Error approving deposit' });
        }
    },

    rejectCryptoDeposit: async (req, res) => {
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

            transaction.status = 'Rejected';
            transaction.description = `${transaction.description} - Rejected: ${reason || 'Invalid transaction'}`;
            await transaction.save();

            await sendNotification(
                transaction.user._id,
                'Crypto Deposit Rejected',
                `Your ${transaction.cryptoCurrency} deposit was rejected. Reason: ${reason || 'Invalid transaction'}`,
                'warning',
                'high',
                { transactionId: transaction._id }
            );

            res.json({ message: 'Crypto deposit rejected', transaction });
        } catch (err) {
            console.error('Error rejecting crypto deposit:', err);
            res.status(500).json({ message: 'Error rejecting deposit' });
        }
    },

    getCryptoWithdrawals: async (req, res) => {
        try {
            const withdrawals = await Transaction.find({
                type: 'Withdrawal',
                isCrypto: true
            }).populate('user', 'name email').sort({ date: -1 });

            res.json(withdrawals);
        } catch (err) {
            console.error('Error fetching crypto withdrawals:', err);
            res.status(500).json({ message: 'Error fetching crypto withdrawals' });
        }
    },

    approveCryptoWithdrawal: async (req, res) => {
        try {
            const { transactionId } = req.params;
            const { txHash } = req.body;

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
            transaction.txHash = txHash;
            transaction.verifiedAt = new Date();
            transaction.verifiedBy = req.user.id;
            await transaction.save();

            await logSecurityEvent({
                user: req.user.id,
                action: 'CRYPTO_WITHDRAWAL_APPROVED',
                details: `Approved crypto withdrawal ${transaction.reference}`,
                status: 'success',
                req
            });

            await sendNotification(
                transaction.user._id,
                'Crypto Withdrawal Processed',
                `Your ${transaction.cryptoCurrency} withdrawal of $${Math.abs(transaction.amount)} has been sent. TX: ${txHash}`,
                'success',
                'high',
                { transactionId: transaction._id }
            );

            res.json({ message: 'Crypto withdrawal approved', transaction });
        } catch (err) {
            console.error('Error approving crypto withdrawal:', err);
            res.status(500).json({ message: 'Error approving withdrawal' });
        }
    },

    rejectCryptoWithdrawal: async (req, res) => {
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

            // Refund the locked balance
            const user = await User.findById(transaction.user._id);
            user.lockedBalance -= Math.abs(transaction.amount);
            user.totalBalance += Math.abs(transaction.amount);
            await user.save();

            transaction.status = 'Rejected';
            transaction.description = `${transaction.description} - Rejected: ${reason || 'Administrative decision'}`;
            await transaction.save();

            await sendNotification(
                transaction.user._id,
                'Crypto Withdrawal Rejected',
                `Your ${transaction.cryptoCurrency} withdrawal was rejected. Funds have been returned to your balance. Reason: ${reason || 'Administrative decision'}`,
                'warning',
                'high',
                { transactionId: transaction._id }
            );

            res.json({ message: 'Crypto withdrawal rejected, funds returned', transaction });
        } catch (err) {
            console.error('Error rejecting crypto withdrawal:', err);
            res.status(500).json({ message: 'Error rejecting withdrawal' });
        }
    },

    // Get user's crypto wallets for admin view
    getUserCryptoWallets: async (req, res) => {
        try {
            const { userId } = req.params;
            const wallets = await UserCryptoWallet.find({ user: userId });
            res.json(wallets);
        } catch (err) {
            console.error('Error fetching user crypto wallets:', err);
            res.status(500).json({ message: 'Error fetching user wallets' });
        }
    }
};

module.exports = adminCryptoController;
