/**
 * CSRF protection for JWT-based APIs.
 * Since tokens are in Authorization headers (not cookies), the main risk is
 * a malicious site tricking a logged-in user's browser into making requests.
 * Requiring a custom header (X-Requested-With) blocks cross-origin form/fetch
 * attacks because browsers enforce CORS and won't allow custom headers cross-origin
 * without a preflight that our CORS policy will reject.
 */
const csrfProtect = (req, res, next) => {
    // Skip for GET, HEAD, OPTIONS — they should be safe/idempotent
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const requestedWith = req.headers['x-requested-with'];
    if (!requestedWith || requestedWith !== 'XMLHttpRequest') {
        return res.status(403).json({ message: 'Forbidden: missing request header' });
    }

    next();
};

module.exports = csrfProtect;
