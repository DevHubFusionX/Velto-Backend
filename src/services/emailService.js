/**
 * Email Service - Main Entry Point
 * 
 * Re-exports the optimized email service functions.
 * All email logic is now centralized in services/email/index.js
 */

const {
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail
} = require('./email/index');

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail
};
