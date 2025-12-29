const crypto = require('crypto');
const db = require('../utils/db');

const paymentController = {
    handleWebhook: async (req, res) => {
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
            const { reference, amount, metadata, customer } = event.data;
            const realAmount = amount / 100; // Convert kobo to currency
            
            const dashboard = db.getData('dashboard');
            
            // Check if transaction already exists to avoid double-crediting
            const exists = dashboard.recentTransactions.find(tx => tx.reference === reference);
            if (exists) {
                return res.status(200).send('Already processed');
            }

            // Update wallet
            dashboard.totalBalance += realAmount;
            
            // Log transaction
            dashboard.recentTransactions.unshift({
                id: `tx-${Date.now()}`,
                type: 'Deposit',
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                amount: realAmount,
                status: 'Completed',
                reference: reference,
                method: event.data.channel || 'Card'
            });

            db.setData('dashboard', dashboard);
            
            console.log(`Successfully credited ${customer.email} with ${realAmount}`);
        }

        res.status(200).send('OK');
    }
};

module.exports = paymentController;
