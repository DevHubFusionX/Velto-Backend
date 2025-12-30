const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const ErrorResponse = require('../../utils/errorResponse');
const asyncHandler = require('../../middleware/async');
const { logSecurityEvent } = require('../../utils/logger');

// Helper to generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

const loginController = {
    generateToken, // Exported for use in other auth sub-controllers

    login: asyncHandler(async (req, res, next) => {
        const { email, password } = req.body;

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

        if (user.lockUntil && user.lockUntil > Date.now()) {
            const remainingMins = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
            return next(new ErrorResponse(`Account is temporarily locked. Try again in ${remainingMins} minutes.`, 403));
        }

        if (await user.matchPassword(password)) {
            if (user.suspended) {
                return next(new ErrorResponse(user.suspensionReason || 'Account Suspended. Please contact support.', 403));
            }

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
                    balance: user.totalBalance,
                    isEmailVerified: user.isEmailVerified
                }
            });
        } else {
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
    }
};

module.exports = loginController;
