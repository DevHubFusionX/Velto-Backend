const User = require('../../models/User');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const ErrorResponse = require('../../utils/errorResponse');
const asyncHandler = require('../../middleware/async');
const { logSecurityEvent } = require('../../utils/logger');
const { generateToken } = require('./auth.login.controller');

const twoFactorController = {
    setup2FA: asyncHandler(async (req, res, next) => {
        const user = await User.findById(req.user.id);

        const secret = speakeasy.generateSecret({
            name: `SecurityGenesis:${user.email}`
        });

        user.twoFactorSecret = secret.base32;
        await user.save();

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
                    balance: user.totalBalance,
                    isEmailVerified: user.isEmailVerified
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

module.exports = twoFactorController;
