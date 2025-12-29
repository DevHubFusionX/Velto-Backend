const AuditLog = require('../models/AuditLog');

/**
 * Logs a security event to the database
 * @param {Object} data - Event data
 * @param {string} data.user - User ID (optional)
 * @param {string} data.action - Action type (enum)
 * @param {string} data.details - Human readable details
 * @param {string} data.status - success | warning | error | info
 * @param {Object} req - Express request object for IP and UserAgent (optional)
 */
const logSecurityEvent = async ({ user, action, details, status, req }) => {
    try {
        const logData = {
            user: user || null,
            action,
            details,
            status: status || 'info',
            ip: req?.ip || req?.headers['x-forwarded-for'] || 'unknown',
            userAgent: req?.headers['user-agent'] || 'unknown',
            timestamp: new Date()
        };

        const log = await AuditLog.create(logData);
        
        // Console log for immediate visibility in development
        const color = status === 'error' ? '\x1b[31m' : status === 'warning' ? '\x1b[33m' : '\x1b[32m';
        console.log(`${color}[AUDIT] ${action}: ${details}\x1b[0m`);
        
        return log;
    } catch (err) {
        console.error('Failed to save audit log:', err);
    }
};

module.exports = { logSecurityEvent };
