const User = require('../../models/User');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../../services/emailService');

const passwordController = {
    forgotPassword: async (req, res) => {
        try {
            const { email } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.json({ success: true, message: 'If an account exists, a password reset link has been sent' });
            }

            const resetToken = crypto.randomBytes(32).toString('hex');
            user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
            await user.save();

            try {
                await sendPasswordResetEmail(user, resetToken);
                console.log(`Password reset link sent to ${email}`);
                res.json({ success: true, message: 'Password reset link sent to your email' });
            } catch (emailError) {
                console.error('Failed to send password reset email:', emailError);
                user.resetPasswordToken = undefined;
                user.resetPasswordExpire = undefined;
                await user.save();
                res.status(500).json({ message: 'Failed to send password reset email' });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error processing password reset' });
        }
    },

    resetPassword: async (req, res) => {
        try {
            const { token, newPassword } = req.body;

            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

            const user = await User.findOne({
                resetPasswordToken: hashedToken,
                resetPasswordExpire: { $gt: Date.now() }
            });

            if (!user) {
                return res.status(400).json({ message: 'Invalid or expired reset token' });
            }

            user.password = newPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();

            res.json({ success: true, message: 'Password reset successful' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error resetting password' });
        }
    }
};

module.exports = passwordController;
