const User = require('../models/User');
const KYC = require('../models/KYC');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const { logSecurityEvent } = require('../utils/logger');

// Helper to generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

const authController = {
    login: asyncHandler(async (req, res, next) => {
        const { email, password } = req.body;

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            await logSecurityEvent({
                action: 'LOGIN_FAILED',
                details: `Failed login attempt for email: ${email}`,
                status: 'warning',
                req
            });
            return next(new ErrorResponse('Invalid credentials', 401));
        }

        // Check if account is locked
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const remainingMins = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
            return next(new ErrorResponse(`Account is temporarily locked. Try again in ${remainingMins} minutes.`, 403));
        }

        if (await user.matchPassword(password)) {
            if (user.suspended) {
                return next(new ErrorResponse(user.suspensionReason || 'Account Suspended. Please contact support.', 403));
            }

            // Reset login attempts on success
            await user.resetLoginAttempts();

            await logSecurityEvent({
                user: user._id,
                action: 'LOGIN_SUCCESS',
                details: `${user.name} (${user.role}) logged in successfully`,
                status: 'success',
                req
            });

            if (user.twoFactorEnabled) {
                return res.json({
                    success: true,
                    require2FA: true,
                    userId: user._id
                });
            }

            res.json({
                success: true,
                token: generateToken(user._id),
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    location: user.location,
                    joinDate: user.joinDate.toLocaleDateString(),
                    balance: user.totalBalance
                }
            });
        } else {
            // Increment login attempts on failure
            await user.incLoginAttempts();
            await logSecurityEvent({
                user: user._id,
                action: 'LOGIN_FAILED',
                details: `Incorrect password for ${user.email}`,
                status: 'warning',
                req
            });
            return next(new ErrorResponse('Invalid credentials', 401));
        }
    }),



    register: async (req, res) => {
        try {
            console.log('[REGISTER] Request received:', req.body);
            const { name, email, password, phone, location, referralCode: signupReferralCode } = req.body;
            console.log('[REGISTER] Registering user:', { name, email, signupReferralCode });

            const userExists = await User.findOne({ email });
            if (userExists) {
                return res.status(400).json({ message: 'User already exists' });
            }

            // Find referrer if code exists
            let referredBy = null;
            if (signupReferralCode) {
                const referrer = await User.findOne({ referralCode: signupReferralCode });
                if (referrer) {
                    referredBy = referrer._id;
                }
            }

            // Generate unique 8-character referral code
            const myReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

            // Generate 6-digit OTP
            const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
            // Expires in 10 minutes
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

            // Create Pending KYC for Email Verification
            await KYC.create({
                user: user._id,
                docType: 'Email Verification',
                docNumber: verificationToken, // Store token here for ref if needed, or just standard tracking
                status: 'Pending',
                adminNotes: 'Waiting for email verification'
            });

            console.log(`--- EMAIL VERIFICATION CODE for ${email}: ${verificationToken} ---`);

            // Send verification email
            try {
                console.log('[REGISTER] Attempting to send verification email...');
                await sendVerificationEmail(user, verificationToken);
                console.log('[REGISTER] ✅ Verification email sent successfully');
            } catch (emailError) {
                console.error('[REGISTER] ❌ Failed to send verification email:', emailError.message);
                console.error('[REGISTER] Email error stack:', emailError.stack);
                // Don't fail registration if email fails
            }

            if (user) {
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
            } else {
                res.status(400).json({ message: 'Invalid user data' });
            }
        } catch (err) {
            console.error('[REGISTER] ❌ Registration error:', err.message);
            console.error('[REGISTER] Error stack:', err.stack);
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

            // Auto-Approve KYC
            const kyc = await KYC.findOne({ user: user._id, docType: 'Email Verification' });
            if (kyc) {
                kyc.status = 'Approved';
                kyc.approvedAt = Date.now();
                kyc.adminNotes = 'Automatically approved via Email Verification';
                await kyc.save();
            }

            // Send welcome email
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

            // Generate new verification code
            const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
            user.verificationToken = verificationToken;
            user.verificationTokenExpire = new Date(Date.now() + 10 * 60 * 1000);
            await user.save();

            // Send email
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
    },

    forgotPassword: async (req, res) => {
        try {
            const { email } = req.body;
            
            const user = await User.findOne({ email });
            if (!user) {
                // Don't reveal if user exists
                return res.json({ success: true, message: 'If an account exists, a password reset link has been sent' });
            }

            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
            await user.save();

            // Send email
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

            // Set new password
            user.password = newPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();

            res.json({ success: true, message: 'Password reset successful' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error resetting password' });
        }
    },

    getMe: async (req, res) => {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.json(user);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error fetching profile' });
        }
    },

    // 2FA - Google Authenticator Implementation
    setup2FA: asyncHandler(async (req, res, next) => {
        const user = await User.findById(req.user.id);
        
        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `SecurityGenesis:${user.email}`
        });

        // Store temporary secret (don't enable yet)
        user.twoFactorSecret = secret.base32;
        await user.save();

        // Generate QR Code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        res.json({
            success: true,
            qrCode: qrCodeUrl,
            secret: secret.base32
        });
    }),

    verify2FASetup: asyncHandler(async (req, res, next) => {
        const { code } = req.body;
        const user = await User.findById(req.user.id).select('+twoFactorSecret');

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: code
        });

        if (verified) {
            user.twoFactorEnabled = true;
            await user.save();
            
            await logSecurityEvent({
                user: user._id,
                action: 'SETTINGS_UPDATE',
                details: `Two-Factor Authentication (TOTP) enabled`,
                status: 'success',
                req
            });

            res.json({ success: true, message: '2FA enabled successfully' });
        } else {
            return next(new ErrorResponse('Invalid verification code', 400));
        }
    }),

    disable2FA: asyncHandler(async (req, res, next) => {
        const user = await User.findById(req.user.id);
        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        await user.save();

        await logSecurityEvent({
            user: user._id,
            action: 'SETTINGS_UPDATE',
            details: `Two-Factor Authentication (TOTP) disabled`,
            status: 'warning',
            req
        });

        res.json({ success: true, message: '2FA disabled successfully' });
    }),

    verify2FALogin: asyncHandler(async (req, res, next) => {
        const { userId, code } = req.body;
        const user = await User.findById(userId).select('+twoFactorSecret +password');

        if (!user) return next(new ErrorResponse('User not found', 404));

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: code
        });

        if (verified) {
            await logSecurityEvent({
                user: user._id,
                action: 'LOGIN_SUCCESS',
                details: `2FA Verification successful for ${user.email}`,
                status: 'success',
                req
            });

            res.json({
                success: true,
                token: generateToken(user._id),
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    location: user.location,
                    joinDate: user.joinDate.toLocaleDateString(),
                    balance: user.totalBalance
                }
            });
        } else {
            await logSecurityEvent({
                user: user._id,
                action: 'LOGIN_FAILED',
                details: `Invalid 2FA code for ${user.email}`,
                status: 'error',
                req
            });
            return next(new ErrorResponse('Invalid 2FA code', 401));
        }
    })
};

module.exports = authController;
