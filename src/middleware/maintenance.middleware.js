const Settings = require('../models/Settings');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const maintenanceMiddleware = async (req, res, next) => {
    try {
        const settings = await Settings.findOne();
        if (settings && settings.maintenanceMode) {
            // 1. Always allow admin-specific routes
            if (req.originalUrl.startsWith('/api/admin')) {
                return next();
            }

            // 2. Allow auth routes so users/admins can at least try to log in 
            // and we can identify them (like the /me endpoint)
            if (req.originalUrl.startsWith('/api/auth')) {
                return next();
            }

            // 3. If authenticated, check if user is admin
            let token;
            if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
                token = req.headers.authorization.split(' ')[1];
            }

            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    const user = await User.findById(decoded.id);
                    if (user && user.role === 'admin') {
                        return next();
                    }
                } catch (err) {
                    // Invalid token, proceed to block
                }
            }

            return res.status(503).json({ 
                message: 'System is currently under maintenance. Please try again later.',
                maintenanceMode: true
            });
        }
        next();
    } catch (err) {
        console.error('Maintenance middleware error:', err);
        next(); 
    }
};

module.exports = maintenanceMiddleware;
