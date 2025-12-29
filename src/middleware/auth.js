const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided, authorization denied' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
        
        // Fetch specific user fields, exclude password obviously (default behavior)
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        if (user.suspended) {
             return res.status(403).json({ 
                message: 'Account Suspended. Access verified and denied.' 
            });
        }

        // Check for session revocation
        if (user.sessionRevokedAt && decoded.iat * 1000 < user.sessionRevokedAt.getTime()) {
            return res.status(401).json({ message: 'Session has been revoked. Please log in again.' });
        }

        req.user = user;

        // Update lastActive timestamp - fire and forget or await
        user.lastActive = new Date();
        user.save().catch(err => console.error('Error updating user activity:', err));

        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
             return res.status(401).json({ message: 'Not authorized' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: `User role ${req.user.role} is not authorized to access this route` });
        }
        next();
    };
};

module.exports = { protect: auth, authorize };
