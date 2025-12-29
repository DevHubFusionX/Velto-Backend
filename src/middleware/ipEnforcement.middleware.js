const Settings = require('../models/Settings');

/**
 * Middleware to enforce IP whitelisting for Administrative routes
 */
const ipEnforcementMiddleware = async (req, res, next) => {
    try {
        const settings = await Settings.findOne();
        
        // Only run if IP Whitelisting is active
        if (settings?.securityProtocols?.ipWhitelisting) {
            const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const whitelist = settings.securityProtocols.ipWhitelist || [];
            
            // If it's an admin route, be strict
            if (req.originalUrl.startsWith('/api/admin')) {
                const isWhitelisted = whitelist.some(ip => 
                    clientIp === ip || 
                    clientIp.includes(ip) || 
                    (ip === '127.0.0.1' && (clientIp === '::1' || clientIp === '127.0.0.1'))
                );

                if (!isWhitelisted && whitelist.length > 0) {
                    console.warn(`[SECURITY] Blocked unauthorized IP access attempt to Admin API: ${clientIp}`);
                    return res.status(403).json({ 
                        message: 'Access Denied: Your IP address is not whitelisted for administrative access.',
                        ip: clientIp,
                        protocol: 'IP_WHITELIST_ENFORCED'
                    });
                }
            }
        }
        
        next();
    } catch (err) {
        console.error('IP Enforcement middleware error:', err);
        next();
    }
};

module.exports = ipEnforcementMiddleware;
