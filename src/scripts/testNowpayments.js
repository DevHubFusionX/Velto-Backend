const dotenv = require('dotenv');
const path = require('path');

// Load env from the root of backend
dotenv.config({ path: path.join(__dirname, '../../.env') });

const nowpaymentsService = require('../services/nowpayments.service');

async function testConnection() {
    console.log('--- NOWPayments Connection Test ---');
    console.log('API Key:', process.env.NOWPAYMENTS_API_KEY ? 'Present (Hidden)' : 'MISSING');
    console.log('IPN Secret:', process.env.NOWPAYMENTS_IPN_SECRET ? 'Present (Hidden)' : 'MISSING');
    console.log('Backend URL:', process.env.BACKEND_URL || 'MISSING');

    try {
        console.log('\nAttempting to create a test payment (50 USD, USDT TRC20)...');

        const testPayment = await nowpaymentsService.createPayment(
            50,
            'usdttrc20',
            'usdttrc20',
            'TEST-' + Date.now(),
            'Test payment from script'
        );

        console.log('\n✅ SUCCESS!');
        console.log('Payment ID:', testPayment.payment_id);
        console.log('Pay Address:', testPayment.pay_address);
        console.log('Pay Amount:', testPayment.pay_amount);
        console.log('Final Status:', testPayment.payment_status);

    } catch (error) {
        console.error('\n❌ FAILED');
        if (error.response) {
            console.error('Status Code:', error.response.status);
            console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error Message:', error.message);
        }

        console.log('\nTroubleshooting Tips:');
        console.log('1. Verify your API Key is active in NOWPayments dashboard.');
        console.log('2. Ensure the currency code (e.g., "usdttrc20") is correct.');
        console.log('3. check if your IP is whitelisted (if you enabled IP whitelist in NOWPayments).');
    }
}

testConnection();
