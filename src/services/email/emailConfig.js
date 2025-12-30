const nodemailer = require('nodemailer');
let transporter = null;

/**
 * Create email transporter based on environment
 * For development: Uses Gmail
 * For production: Uses configured email service
 */
const getTransporter = () => {
    if (transporter) return transporter;

    if (process.env.NODE_ENV === 'production') {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS
            }
        });
    } else {
        // Development: Use Gmail or create test account
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'your-email@gmail.com',
                pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS || 'your-app-password'
            }
        });
    }

    return transporter;
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
            from: `"Investment Platform" <${process.env.EMAIL_USER || 'noreply@investment.com'}>`,
            to,
            subject,
            html
        };

        const info = await mailTransporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new Error('Failed to send email');
    }
};

module.exports = {
    getTransporter,
    sendEmail
};
