const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const CryptoWallet = require('../../models/CryptoWallet');
const Settings = require('../../models/Settings');
const { sendNotification, sendAdminNotification } = require('../../utils/notification');

const USDT_INFO = {
    USDT_TRC20: { name: 'USDT (TRC20)', network: 'TRC20' },
    USDT_ERC20: { name: 'USDT (ERC20)', network: 'ERC20' }
};

const cryptoController = {
    getMyWallets: async (req, res) => res.json([]),

    getDepositAddresses: async (req, res) => {
        try {
            const settings = await Settings.findOne();
            const wallets = await CryptoWallet.find({ isActive: true, currency: { $in: ['USDT_TRC20', 'USDT_ERC20'] } });
            res.json({
                wallets,
                settings: {
                    enabled: settings?.crypto?.enabled ?? true,
                    minDeposit: settings?.crypto?.depositMinUsd || 10,
                    maxDeposit: settings?.crypto?.depositMaxUsd || 100000,
                    minWithdrawal: settings?.crypto?.withdrawalMinUsd || 20,
                    maxWithdrawal: settings?.crypto?.withdrawalMaxUsd || 50000
                }
            });
        } catch (err) {
            res.status(500).json({ message: 'Error fetching deposit addresses' });
        }
    },

    initiateCryptoDeposit: async (req, res) => {
        try {
            const { cryptoCurrency, amountUsd, txHash } = req.body;

            if (!USDT_INFO[cryptoCurrency]) {
                return res.status(400).json({ message: 'Only USDT_TRC20 and USDT_ERC20 are supported' });
            }
            if (!txHash || !txHash.trim()) {
                return res.status(400).json({ message: 'Transaction hash is required' });
            }

            const settings = await Settings.findOne();
            if (!settings?.crypto?.enabled) {
                return res.status(400).json({ message: 'Deposits are currently disabled' });
            }

            const minDeposit = settings.crypto.depositMinUsd || 10;
            const maxDeposit = settings.crypto.depositMaxUsd || 100000;

            if (amountUsd < minDeposit) return res.status(400).json({ message: `Minimum deposit is $${minDeposit}` });
            if (amountUsd > maxDeposit) return res.status(400).json({ message: `Maximum deposit is $${maxDeposit}` });

            const existing = await Transaction.findOne({ txHash: txHash.trim() });
            if (existing) return res.status(400).json({ message: 'This transaction hash has already been submitted' });

            const user = await User.findById(req.user.id);
            const transaction = await Transaction.create({
                user: user._id,
                type: 'Deposit',
                amount: amountUsd,
                requestedAmount: amountUsd,
                currency: 'USD',
                status: 'Pending',
                reference: `USDT-DEP-${Date.now()}`,
                method: 'Crypto',
                description: `USDT deposit via ${USDT_INFO[cryptoCurrency].network}`,
                isCrypto: true,
                cryptoCurrency,
                txHash: txHash.trim(),
                network: USDT_INFO[cryptoCurrency].network
            });

            await sendNotification(user._id, 'Deposit Submitted',
                `Your USDT deposit of $${amountUsd} is pending admin verification.`,
                'deposit', 'normal', { transactionId: transaction._id });

            await sendAdminNotification('New USDT Deposit',
                `${user.email} submitted a $${amountUsd} USDT (${USDT_INFO[cryptoCurrency].network}) deposit. TX: ${txHash}`,
                'deposit', 'high', { transactionId: transaction._id, userId: user._id });

            res.json({ message: 'Deposit submitted for verification', transaction });
        } catch (err) {
            console.error('Error initiating deposit:', err);
            res.status(500).json({ message: 'Error processing deposit' });
        }
    },

    submitCryptoProof: async (req, res) => res.status(410).json({ message: 'Submit TX hash via initiateCryptoDeposit instead' }),

    requestCryptoWithdrawal: async (req, res) => {
        try {
            const { cryptoCurrency, cryptoAddress, amountUsd } = req.body;

            if (!USDT_INFO[cryptoCurrency]) {
                return res.status(400).json({ message: 'Only USDT_TRC20 and USDT_ERC20 are supported' });
            }
            if (!cryptoAddress || !cryptoAddress.trim()) {
                return res.status(400).json({ message: 'USDT wallet address is required' });
            }

            const settings = await Settings.findOne();
            if (!settings?.crypto?.enabled) {
                return res.status(400).json({ message: 'Withdrawals are currently disabled' });
            }

            const minWithdraw = settings.crypto.withdrawalMinUsd || 20;
            const maxWithdraw = settings.crypto.withdrawalMaxUsd || 50000;

            if (amountUsd < minWithdraw) return res.status(400).json({ message: `Minimum withdrawal is $${minWithdraw}` });
            if (amountUsd > maxWithdraw) return res.status(400).json({ message: `Maximum withdrawal is $${maxWithdraw}` });

            const user = await User.findById(req.user.id);
            if (amountUsd > user.totalBalance) return res.status(400).json({ message: 'Insufficient funds' });

            const transaction = await Transaction.create({
                user: user._id,
                type: 'Withdrawal',
                amount: -amountUsd,
                currency: 'USD',
                status: 'Pending',
                reference: `USDT-WTH-${Date.now()}`,
                method: 'Crypto',
                description: `USDT withdrawal to ${USDT_INFO[cryptoCurrency].network} wallet`,
                isCrypto: true,
                cryptoCurrency,
                cryptoAddress: cryptoAddress.trim(),
                network: USDT_INFO[cryptoCurrency].network
            });

            user.totalBalance -= amountUsd;
            user.lockedBalance += amountUsd;
            await user.save();

            await sendNotification(user._id, 'Withdrawal Requested',
                `Your withdrawal of $${amountUsd} USDT (${USDT_INFO[cryptoCurrency].network}) is pending processing.`,
                'withdrawal', 'high', { transactionId: transaction._id });

            await sendAdminNotification('New USDT Withdrawal Request',
                `${user.email} requested $${amountUsd} USDT (${USDT_INFO[cryptoCurrency].network}) to ${cryptoAddress}`,
                'admin', 'high', { transactionId: transaction._id, userId: user._id });

            res.json({ message: 'Withdrawal request submitted', newBalance: user.totalBalance, transaction });
        } catch (err) {
            console.error('Error processing withdrawal:', err);
            res.status(500).json({ message: 'Error processing withdrawal' });
        }
    }
};

module.exports = cryptoController;
