const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Convert string boolean values to actual booleans
 */
const toBool = (val) => val === 'true' || val === true;

/**
 * Configure email transporter with connection pooling
 */
const createTransporter = () => {
    // Default config using environment variables
    const config = {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '465'),
        secure: toBool(process.env.EMAIL_SECURE) || parseInt(process.env.EMAIL_PORT) === 465, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS
        },
        // Connection Pooling Settings
        pool: true, // Use pooled connections
        maxConnections: 5, // Limit concurrent connections
        maxMessages: 100, // Limit messages per connection
        rateLimit: 10 // Limit messages per second
    };

    // Development override if needed
    if (process.env.NODE_ENV !== 'production' && !process.env.EMAIL_USER) {
        console.warn('⚠️ No EMAIL_USER found. Email sending will fail in development.');
    }

    return nodemailer.createTransport(config);
};

const getTransporter = () => {
    if (!transporter) {
        transporter = createTransporter();
    }
    return transporter;
};

/**
 * Verify SMTP connection functionality
 */
const verifyConnection = async () => {
    try {
        const transport = getTransporter();
        await transport.verify();
        console.log('✅ Email service connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Email service connection failed:', error.message);
        return false;
    }
};

/**
 * Send email with the configured transporter
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @returns {Promise<Object>} - Send result
 */
const sendEmail = async ({ to, subject, html }) => {
    try {
        const mailTransporter = getTransporter();

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'Velto Investment'}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        };

        const info = await mailTransporter.sendMail(mailOptions);
        console.log(`[EMAIL] Sent to ${to} | ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[EMAIL] Failed to send to ${to}:`, error.message);
        // We log but don't crash the app. The caller can handle the error if strict delivery is required.
        throw new Error(`Email sending failed: ${error.message}`);
    }
};

module.exports = {
    getTransporter,
    verifyConnection,
    sendEmail
};
