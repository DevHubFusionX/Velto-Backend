const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

const paymentController = {
    handleWebhook: async (req, res) => {
        try {
            // 1. Verify Paystack signature
            const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
                               .update(JSON.stringify(req.body))
                               .digest('hex');
            
            if (hash !== req.headers['x-paystack-signature']) {
                return res.status(401).send('Invalid signature');
            }

            const event = req.body;

            // 2. Handle successful payment
            if (event.event === 'charge.success') {
                const { reference, amount, metadata, customer, channel } = event.data;
                const realAmount = amount / 100; // Paystack sends amount in kobo (or lowest currency unit)
                
                // Idempotency: Check if transaction already processed
                const existingTx = await Transaction.findOne({ reference });

                if (existingTx) {
                    if (existingTx.status === 'Completed') {
                        return res.status(200).send('Already processed');
                    }

                    // Update existing pending transaction
                    existingTx.status = 'Completed';
                    existingTx.amount = realAmount; // Trust the actual paid amount
                    existingTx.gatewayReference = event.data.id.toString();
                    existingTx.method = channel || 'Paystack';
                    existingTx.verifiedAt = new Date();
                    await existingTx.save();

                    // Credit User Balance
                    const user = await User.findById(existingTx.user);
                    if (user) {
                        user.totalBalance += realAmount;
                        await user.save();
                        console.log(`Payment Webhook: Credited ${user.email} with ${realAmount}`);
                    }
                } else {
                    // Transaction likely initiated directly via Paystack standard checkout without prior API call?
                    // OR system drift. For safety, try to find user by email from Paystack customer data
                    const user = await User.findOne({ email: customer.email });
                    
                    if (user) {
                         // Create new completed transaction
                        await Transaction.create({
                            user: user._id,
                            type: 'Deposit',
                            amount: realAmount,
                            status: 'Completed',
                            reference: reference, // Use Paystack reference
                            gatewayReference: event.data.id.toString(),
                            method: channel || 'Paystack',
                            description: 'Direct Deposit via Paystack',
                            verifiedAt: new Date()
                        });

                        user.totalBalance += realAmount;
                        await user.save();
                        console.log(`Payment Webhook (New Tx): Credited ${user.email} with ${realAmount}`);
                    } else {
                        console.warn(`Payment Webhook: Unknown user ${customer.email} for ref ${reference}`);
                    }
                }
            }

            res.status(200).send('OK');
        } catch (error) {
            console.error('Webhook Error:', error);
            res.status(500).send('Webhook failed');
        }
    }
};

module.exports = paymentController;
