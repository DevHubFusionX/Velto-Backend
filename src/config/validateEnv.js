const validateEnv = () => {
    // Optional with defaults
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';
    process.env.PORT = process.env.PORT || 5000;
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173';
    process.env.EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';

    const required = [
        'MONGO_URI',
        'JWT_SECRET'
    ];

    // Handle both EMAIL_PASS and EMAIL_PASSWORD for flexibility
    const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    const emailUser = process.env.EMAIL_USER;

    const missing = required.filter(key => !process.env[key]);
    
    if (!emailPass || !emailUser) {
        console.warn('\x1b[33m[WARN] Email credentials missing. Email service will not work.\x1b[0m');
    }

    if (missing.length > 0) {
        console.error(`\x1b[31m[CRITICAL] Missing required environment variables: ${missing.join(', ')}\x1b[0m`);
        process.exit(1);
    }

    console.log('\x1b[32m[INFO] Environment variables validated.\x1b[0m');
};

module.exports = validateEnv;
