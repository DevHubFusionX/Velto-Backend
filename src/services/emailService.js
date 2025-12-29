/**
 * Email Service - Main Entry Point
 * 
 * This file re-exports all email service functions from the modular structure.
 * Import from this file to maintain backward compatibility.
 * 
 * New structure:
 * - email/emailConfig.js - Nodemailer configuration and base send function
 * - email/emailTemplates.js - HTML email templates
 * - email/index.js - High-level email service functions
 */

const {
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail
} = require('./email');

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail
};
