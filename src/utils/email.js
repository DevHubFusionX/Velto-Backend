const nodemailer = require('nodemailer');

// Configure transporter
// For production, use actual SMTP settings in .env
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER || 'placeholder@example.com',
        pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS || 'placeholder_pass',
    },
});

/**
 * Send an email notification
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Plain text body
 * @param {string} html - HTML body (optional)
 */
const sendEmail = async (to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Velto Support" <${process.env.EMAIL_FROM || 'noreply@velto.com'}>`,
            to,
            subject,
            text,
            html: html || text,
        });

        console.log(`[EMAIL] Message sent to ${to}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[EMAIL] Failed to send email to ${to}:`, error);
        // Do not throw error to avoid blocking main application logic
        return null;
    }
};

module.exports = { sendEmail };
