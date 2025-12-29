const axios = require('axios');

class PaystackService {
    constructor() {
        this.secretKey = process.env.PAYSTACK_SECRET_KEY;
        this.baseUrl = 'https://api.paystack.co';
    }

    async initializeTransaction(email, amount, metadata = {}) {
        try {
            // Paystack amount is in kobo (multiply by 100)
            const response = await axios.post(
                `${this.baseUrl}/transaction/initialize`,
                {
                    email,
                    amount: amount * 100,
                    metadata,
                    callback_url: `${process.env.FRONTEND_URL}/dashboard?status=success`
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Paystack Initialization Error:', error.response?.data || error.message);
            throw new Error('Failed to initialize Paystack transaction');
        }
    }

    async verifyTransaction(reference) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/transaction/verify/${reference}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.secretKey}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Paystack Verification Error:', error.response?.data || error.message);
            throw new Error('Failed to verify Paystack transaction');
        }
    }
}

module.exports = new PaystackService();
