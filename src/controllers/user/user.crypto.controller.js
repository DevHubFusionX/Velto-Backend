const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const CryptoWallet = require('../../models/CryptoWallet');
const UserCryptoWallet = require('../../models/UserCryptoWallet');
const Settings = require('../../models/Settings');
const { sendNotification, sendAdminNotification } = require('../../utils/notification');
const nowpaymentsService = require('../../services/nowpayments.service');

const cryptoController = {
    // Get user's auto-generated wallet addresses
    getMyWallets: async (req, res) => {
        try {
            const wallets = await UserCryptoWallet.find({ user: req.user.id });
            res.json(wallets);
        } catch (err) {
            console.error('Error fetching user wallets:', err);
            res.status(500).json({ message: 'Error fetching your crypto wallets' });
        }
    },

    // Get admin deposit addresses (where users should send crypto)
    getDepositAddresses: async (req, res) => {
        try {
            const settings = await Settings.findOne();
            const supportedCurrencies = settings?.crypto?.supportedCurrencies || [];

            const wallets = await CryptoWallet.find({
                isActive: true,
                currency: { $in: supportedCurrencies }
            });

            res.json({
                wallets,
                settings: {
                    enabled: settings?.crypto?.enabled ?? true,
                    minDeposit: settings?.crypto?.depositMinUsd || 10,
                    maxDeposit: settings?.crypto?.depositMaxUsd || 100000
                }
            });
        } catch (err) {
            console.error('Error fetching deposit addresses:', err);
            res.status(500).json({ message: 'Error fetching deposit addresses' });
        }
    },

    // Initiate a crypto deposit (user claims they sent crypto)
    initiateCryptoDeposit: async (req, res) => {
        try {
            const { cryptoCurrency, amountUsd } = req.body;

            const settings = await Settings.findOne();
            if (!settings?.crypto?.enabled) {
                return res.status(400).json({ message: 'Crypto deposits are currently disabled' });
            }

            const minDeposit = settings.crypto.depositMinUsd || 10;
            const maxDeposit = settings.crypto.depositMaxUsd || 100000;

            if (amountUsd < minDeposit) {
                return res.status(400).json({ message: `Minimum deposit is $${minDeposit}` });
            }
            if (amountUsd > maxDeposit) {
                return res.status(400).json({ message: `Maximum deposit is $${maxDeposit}` });
            }

            const user = await User.findById(req.user.id);
            const reference = `CRYPTO-DEP-${Date.now()}`;

            console.log(`[Deposit] Creating payment for ${amountUsd} ${cryptoCurrency}`);
            // 1. Create NOWPayments payment
            const paymentData = await nowpaymentsService.createPayment(
                amountUsd,
                cryptoCurrency.toLowerCase(), // currency_from
                cryptoCurrency.toLowerCase(), // currency_to (same coin for direct deposit)
                reference,
                `Deposit from ${user.email}`
            );
            console.log('[Deposit] NOWPayments payment created:', paymentData.payment_id);

            // 2. Create Transaction record in our DB
            const transaction = await Transaction.create({
                user: user._id,
                type: 'Deposit',
                amount: amountUsd,
                requestedAmount: amountUsd,
                currency: 'USD',
                status: 'Pending',
                reference: reference,
                method: 'Crypto',
                description: `Automated Crypto deposit via ${cryptoCurrency}`,
                isCrypto: true,
                cryptoCurrency,
                paymentId: paymentData.payment_id,
                payAddress: paymentData.pay_address,
                payAmount: paymentData.pay_amount,
                paymentStatus: paymentData.payment_status,
                network: cryptoCurrency.includes('USDT') ? (cryptoCurrency.includes('TRC20') ? 'TRC20' : 'ERC20') : cryptoCurrency
            });
            console.log('[Deposit] Transaction record created:', transaction._id);

            await sendNotification(
                user._id,
                'Deposit Address Generated',
                `Please send ${paymentData.pay_amount} ${cryptoCurrency} to the generated address.`,
                'deposit',
                'normal',
                { transactionId: transaction._id }
            );
            console.log('[Deposit] Notification triggered');

            res.json({
                message: 'Deposit address generated',
                payAddress: paymentData.pay_address,
                payAmount: paymentData.pay_amount,
                paymentId: paymentData.payment_id,
                transaction
            });
        } catch (err) {
            console.error('Error initiating crypto deposit:', err);

            // Extract specific gateway error details
            const gatewayError = err.response?.data;
            let errorMessage = 'Error processing crypto deposit. Please try again.';
            let statusCode = 500;

            if (gatewayError) {
                if (gatewayError.code === 'AMOUNT_MINIMAL_ERROR') {
                    errorMessage = `The amount is too low for ${cryptoCurrency}. Please try a higher amount (e.g. $20).`;
                    statusCode = 400;
                } else if (gatewayError.message) {
                    errorMessage = gatewayError.message;
                }
            }

            res.status(statusCode).json({
                message: errorMessage,
                error: err.message,
                details: gatewayError || null
            });
        }
    },

    // Request crypto withdrawal
    requestCryptoWithdrawal: async (req, res) => {
        try {
            const { cryptoCurrency, cryptoAddress, amountUsd, network } = req.body;

            const settings = await Settings.findOne();
            if (!settings?.crypto?.enabled) {
                return res.status(400).json({ message: 'Crypto withdrawals are currently disabled' });
            }

            const minWithdraw = settings.crypto.withdrawalMinUsd || 20;
            const maxWithdraw = settings.crypto.withdrawalMaxUsd || 50000;

            if (amountUsd < minWithdraw) {
                return res.status(400).json({ message: `Minimum withdrawal is $${minWithdraw}` });
            }
            if (amountUsd > maxWithdraw) {
                return res.status(400).json({ message: `Maximum withdrawal is $${maxWithdraw}` });
            }

            const user = await User.findById(req.user.id);

            if (amountUsd > user.totalBalance) {
                return res.status(400).json({ message: 'Insufficient funds' });
            }

            const transaction = await Transaction.create({
                user: user._id,
                type: 'Withdrawal',
                amount: -amountUsd,
                currency: 'USD',
                status: 'Pending',
                reference: `CRYPTO-WTH-${Date.now()}`,
                method: 'Crypto',
                description: `Crypto withdrawal to ${cryptoCurrency} wallet`,
                isCrypto: true,
                cryptoCurrency,
                cryptoAddress,
                network
            });

            // Lock the funds
            user.totalBalance -= amountUsd;
            user.lockedBalance += amountUsd;
            await user.save();

            await sendNotification(
                user._id,
                'Crypto Withdrawal Requested',
                `Your withdrawal of $${amountUsd} to ${cryptoCurrency} wallet has been submitted.`,
                'withdrawal',
                'high',
                { transactionId: transaction._id }
            );

            await sendAdminNotification(
                'New Crypto Withdrawal Request',
                `User ${user.email} requested ${cryptoCurrency} withdrawal of $${amountUsd} to ${cryptoAddress}`,
                'admin',
                'high',
                { transactionId: transaction._id, userId: user._id }
            );

            res.json({
                message: 'Crypto withdrawal request submitted',
                newBalance: user.totalBalance,
                transaction
            });
        } catch (err) {
            console.error('Error processing crypto withdrawal:', err);
            res.status(500).json({ message: 'Error processing crypto withdrawal' });
        }
    }
};

module.exports = cryptoController;
