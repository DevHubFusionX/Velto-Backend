const User = require('../../models/User');
const KYC = require('../../models/KYC');
const { sendVerificationEmail, sendWelcomeEmail } = require('../../services/emailService');
const { generateToken } = require('./auth.login.controller');

const registerController = {
    register: async (req, res) => {
        try {
            console.log('[REGISTER] Request received:', req.body);
            const { name, email, password, phone, location, referralCode: signupReferralCode } = req.body;
            console.log('[REGISTER] Registering user:', { name, email, signupReferralCode });

            const userExists = await User.findOne({ email });
            if (userExists) {
                return res.status(400).json({ message: 'User already exists' });
            }

            let referredBy = null;
            if (signupReferralCode) {
                const referrer = await User.findOne({ referralCode: signupReferralCode });
                if (referrer) {
                    referredBy = referrer._id;
                }
            }

            const myReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
            const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
            const verificationTokenExpire = new Date(Date.now() + 10 * 60 * 1000);

            const user = await User.create({
                name,
                email,
                password,
                phone,
                location,
                verificationToken,
                verificationTokenExpire,
                referralCode: myReferralCode,
                referredBy
            });

            await KYC.create({
                user: user._id,
                docType: 'Email Verification',
                docNumber: verificationToken,
                status: 'Pending',
                adminNotes: 'Waiting for email verification'
            });

            console.log(`--- EMAIL VERIFICATION CODE for ${email}: ${verificationToken} ---`);

            // Non-blocking email dispatch
            sendVerificationEmail(user, verificationToken)
                .then(() => console.log('[REGISTER] ✅ Verification email sent successfully'))
                .catch(emailError => console.error('[REGISTER] ❌ Failed to send verification email:', emailError.message));

            res.status(201).json({
                token: generateToken(user._id),
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    location: user.location,
                    joinDate: user.joinDate.toLocaleDateString(),
                    isEmailVerified: user.isEmailVerified
                }
            });
        } catch (err) {
            console.error('[REGISTER] ❌ Registration error:', err.message);
            res.status(500).json({ message: 'Server error during registration', error: err.message });
        }
    },

    verifyEmail: async (req, res) => {
        try {
            const { email, code } = req.body;

            const user = await User.findOne({
                email,
                verificationToken: code,
                verificationTokenExpire: { $gt: Date.now() }
            });

            if (!user) {
                return res.status(400).json({ message: 'Invalid or expired verification code' });
            }

            user.isEmailVerified = true;
            user.verificationToken = undefined;
            user.verificationTokenExpire = undefined;
            await user.save();

            const kyc = await KYC.findOne({ user: user._id, docType: 'Email Verification' });
            if (kyc) {
                kyc.status = 'Approved';
                kyc.approvedAt = Date.now();
                kyc.adminNotes = 'Automatically approved via Email Verification';
                await kyc.save();
            }

            try {
                await sendWelcomeEmail(user);
                console.log('Welcome email sent successfully');
            } catch (emailError) {
                console.error('Failed to send welcome email:', emailError);
            }

            res.json({ success: true, message: 'Email verified and KYC approved successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error verifying email' });
        }
    },

    resendVerification: async (req, res) => {
        try {
            const { email } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (user.isEmailVerified) {
                return res.status(400).json({ message: 'Email already verified' });
            }

            const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
            user.verificationToken = verificationToken;
            user.verificationTokenExpire = new Date(Date.now() + 10 * 60 * 1000);
            await user.save();

            try {
                await sendVerificationEmail(user, verificationToken);
                console.log(`Resent verification code to ${email}: ${verificationToken}`);
                res.json({ success: true, message: 'Verification code sent to your email' });
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
                res.status(500).json({ message: 'Failed to send verification email' });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error resending verification' });
        }
    }
};

module.exports = registerController;
