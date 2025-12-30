const axios = require('axios');
const crypto = require('crypto');

class NOWPaymentsService {
    constructor() {
        this.apiKey = process.env.NOWPAYMENTS_API_KEY;
        this.ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
        this.baseUrl = 'https://api.nowpayments.io/v1';
    }

    async createPayment(amount, currency_from, currency_to, order_id, order_description) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/payment`,
                {
                    price_amount: amount,
                    price_currency: 'usd',
                    pay_currency: currency_from,
                    ipn_callback_url: `${process.env.BACKEND_URL}/api/webhooks/nowpayments`,
                    order_id,
                    order_description
                },
                {
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('NOWPayments Creation Error:', error.response?.data || error.message);
            throw new Error('Failed to create NOWPayments transaction');
        }
    }

    async getPaymentStatus(paymentId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/payment/${paymentId}`,
                {
                    headers: {
                        'x-api-key': this.apiKey
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('NOWPayments Status Error:', error.response?.data || error.message);
            throw new Error('Failed to fetch NOWPayments status');
        }
    }

    verifyIPN(payload, signature) {
        if (!this.ipnSecret) {
            console.warn('NOWPAYMENTS_IPN_SECRET not set, skipping verification');
            return true; // For development if not set
        }

        const hmac = crypto.createHmac('sha512', this.ipnSecret);
        // Ensure payload is a sorted JSON string if that's what NOWPayments expects, 
        // but usually, it's the raw body string.
        const serializedPayload = JSON.stringify(payload, Object.keys(payload).sort());
        hmac.update(serializedPayload);
        const digest = hmac.digest('hex');

        return digest === signature;
    }
}

module.exports = new NOWPaymentsService();
