require('dotenv').config();
const { verifyConnection, sendEmail } = require('./src/services/email/emailConfig');

const runTest = async () => {
    console.log('--- Starting Email Service Diagnostic (Resend) ---');

    // 1. Verify Connection
    console.log('\n1. Testing Resend API Connection...');
    const isConnected = await verifyConnection();

    if (isConnected) {
        // 2. Try Sending Email
        const testRecipient = process.argv[2];
        if (testRecipient) {
            console.log(`\n2. Attempting to send test email to: ${testRecipient}`);
            try {
                const result = await sendEmail({
                    to: testRecipient,
                    subject: 'Velto Email Test (Resend)',
                    html: '<h1>It works!</h1><p>Your Resend email service is configured correctly.</p>'
                });
                console.log('✅ Email sent successfully!', result);
            } catch (error) {
                console.error('❌ Failed to send email:', error.message);
            }
        } else {
            console.log('\nℹ️ No recipient provided. Skipping send test.');
            console.log('Usage: node test-email.js <your-email@example.com>');
        }
    } else {
        console.error('❌ Resend initialization failed. Check your RESEND_API_KEY.');
    }

    console.log('\n--- Diagnostic Complete ---');
    process.exit(0);
};

runTest();
