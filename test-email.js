require('dotenv').config();
const { verifyConnection, sendEmail } = require('./src/services/email/emailConfig');

const runTest = async () => {
    console.log('--- Starting Email Service Diagnostic ---');
    console.log('Checking configuration...');

    // 1. Verify Connection
    console.log('\n1. Testing SMTP Connection...');
    const isConnected = await verifyConnection();

    if (isConnected) {
        console.log('✅ Connection verification passed!');

        // 2. Try Sending Email
        // Only if a recipient is provided as argument, otherwise just skip
        const testRecipient = process.argv[2];
        if (testRecipient) {
            console.log(`\n2. Attempting to send test email to: ${testRecipient}`);
            try {
                const result = await sendEmail({
                    to: testRecipient,
                    subject: 'Velto Email Test',
                    html: '<h1>It works!</h1><p>Your email service is configured correctly.</p>'
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
        console.error('❌ Connection verification failed. Check your network, credentials, or firewall.');
    }

    console.log('\n--- Diagnostic Complete ---');
    process.exit(0);
};

runTest();
