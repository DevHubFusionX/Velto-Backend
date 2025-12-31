const { Resend } = require('resend');

let resendClient = null;

/**
 * Get or create Resend client
 */
const getResendClient = () => {
    if (!resendClient) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.error('❌ RESEND_API_KEY is not set in environment variables');
            return null;
        }
        resendClient = new Resend(apiKey);
    }
    return resendClient;
};

/**
 * Verify Resend connection by checking API key validity
 */
const verifyConnection = async () => {
    try {
        const client = getResendClient();
        if (!client) {
            console.error('❌ Email service connection failed: No API key');
            return false;
        }
        // Resend doesn't have a verify endpoint, but we can check the client exists
        console.log('✅ Email service (Resend) initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Email service connection failed:', error.message);
        return false;
    }
};

/**
 * Send email using Resend API
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @returns {Promise<Object>} - Send result
 */
const sendEmail = async ({ to, subject, html }) => {
    try {
        const client = getResendClient();
        if (!client) {
            throw new Error('Resend client not initialized. Check RESEND_API_KEY.');
        }

        // Use Resend's default sending domain for free tier
        // For production, you should verify your own domain on Resend
        const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
        const fromName = process.env.EMAIL_FROM_NAME || 'Velto Investment';

        const { data, error } = await client.emails.send({
            from: `${fromName} <${fromAddress}>`,
            to: [to],
            subject,
            html
        });

        if (error) {
            console.error(`[EMAIL] Failed to send to ${to}:`, error.message);
            throw new Error(`Email sending failed: ${error.message}`);
        }

        console.log(`[EMAIL] Sent to ${to} | ID: ${data.id}`);
        return { success: true, messageId: data.id };
    } catch (error) {
        console.error(`[EMAIL] Failed to send to ${to}:`, error.message);
        throw new Error(`Email sending failed: ${error.message}`);
    }
};

module.exports = {
    getResendClient,
    verifyConnection,
    sendEmail
};
