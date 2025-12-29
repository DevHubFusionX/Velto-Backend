const { sendEmail } = require('./emailConfig');
const {
    verificationEmailTemplate,
    passwordResetEmailTemplate,
    welcomeEmailTemplate
} = require('./emailTemplates');

/**
 * Send verification email to user
 * @param {Object} user - User object with name and email
 * @param {string} verificationToken - Verification token/code
 */
const sendVerificationEmail = async (user, verificationToken) => {
    const html = verificationEmailTemplate(user, verificationToken);
    
    return sendEmail({
        to: user.email,
        subject: 'Verify Your Email Address',
        html
    });
};

/**
 * Send password reset email to user
 * @param {Object} user - User object with name and email
 * @param {string} resetToken - Password reset token
 */
const sendPasswordResetEmail = async (user, resetToken) => {
    const html = passwordResetEmailTemplate(user, resetToken);
    
    return sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        html
    });
};

/**
 * Send welcome email after successful verification
 * @param {Object} user - User object with name and email
 */
const sendWelcomeEmail = async (user) => {
    const html = welcomeEmailTemplate(user);
    
    return sendEmail({
        to: user.email,
        subject: 'Welcome to Investment Platform!',
        html
    });
};

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail
};
