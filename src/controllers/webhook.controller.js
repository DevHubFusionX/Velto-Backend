const Transaction = require('../models/Transaction');
const User = require('../models/User');
const nowpaymentsService = require('../services/nowpayments.service');
const { sendNotification, sendAdminNotification } = require('../utils/notification');

const webhookController = {
    handleNOWPaymentsIPN: async (req, res) => {
        try {
            const signature = req.headers['x-nowpayments-sig'];
            const payload = req.body;

            console.log('[NOWPayments Webhook] Received IPN:', JSON.stringify(payload));

            // 1. Verify Signature
            if (!nowpaymentsService.verifyIPN(payload, signature)) {
                console.error('[NOWPayments Webhook] Invalid signature');
                return res.status(400).json({ message: 'Invalid signature' });
            }

            const {
                order_id,
                payment_status,
                pay_amount,
                actually_paid,
                pay_currency,
                payment_id,
                price_amount // This should be the USD amount if we sent it as USD
            } = payload;

            // 2. Find the transaction
            const transaction = await Transaction.findOne({ reference: order_id });
            if (!transaction) {
                console.error(`[NOWPayments Webhook] Transaction not found for reference: ${order_id}`);
                return res.status(404).json({ message: 'Transaction not found' });
            }

            // Update gateway details
            transaction.paymentStatus = payment_status;
            transaction.actuallyPaid = actually_paid;
            transaction.txHash = payload.purchase_id || transaction.txHash; // NOWPayments uses purchase_id or similar sometimes

            // 3. Handle Status
            if (payment_status === 'finished') {
                if (transaction.status === 'Completed') {
                    console.log(`[NOWPayments Webhook] Transaction ${order_id} already completed.`);
                    return res.json({ message: 'Already processed' });
                }

                const user = await User.findById(transaction.user);
                if (!user) {
                    console.error(`[NOWPayments Webhook] User not found for transaction: ${order_id}`);
                    return res.status(404).json({ message: 'User not found' });
                }

                // Credit User Balance
                // We trust 'price_amount' as the USD value if we set 'price_currency: usd' during creation
                const amountToCredit = price_amount || transaction.amount;

                user.totalBalance += amountToCredit;
                await user.save();

                transaction.status = 'Completed';
                transaction.verifiedAt = Date.now();
                await transaction.save();

                await sendNotification(
                    user._id,
                    'Deposit Confirmed',
                    `Your deposit of $${amountToCredit} has been successfully credited to your balance.`,
                    'deposit',
                    'success',
                    { transactionId: transaction._id }
                );

                await sendAdminNotification(
                    'Crypto Deposit Completed',
                    `User ${user.email} deposit of $${amountToCredit} (${pay_currency}) confirmed via NOWPayments.`,
                    'admin',
                    'normal',
                    { transactionId: transaction._id, userId: user._id }
                );

                console.log(`[NOWPayments Webhook] Successfully credited $${amountToCredit} to user ${user.email}`);
            } else if (payment_status === 'failed' || payment_status === 'refunded') {
                transaction.status = 'Failed';
                await transaction.save();

                await sendNotification(
                    transaction.user,
                    'Deposit Failed',
                    `Your crypto deposit (${order_id}) has reached status: ${payment_status}.`,
                    'warning',
                    'high',
                    { transactionId: transaction._id }
                );
            } else {
                // Pending, Confirmed, Waiting, etc.
                await transaction.save();
                console.log(`[NOWPayments Webhook] Payment ${order_id} is in status: ${payment_status}`);
            }

            res.json({ status: 'ok' });
        } catch (err) {
            console.error('[NOWPayments Webhook] Error:', err);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
};

module.exports = webhookController;
