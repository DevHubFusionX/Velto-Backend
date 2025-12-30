const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { startCronOnly } = require('./services/cronService');

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

dotenv.config();

// Start Cron Jobs
startCronOnly();

const app = express();

// Trust proxy for Render/Vercel
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174', 
    'https://velto-steel.vercel.app',
    'https://velto-management.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Set security headers
app.use(helmet());

// Prevent NoSQL injection
app.use(mongoSanitize());

// Prevent XSS attacks
app.use(xss());

// Prevent http param pollution
app.use(hpp());

// Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 requests per windowMs for auth routes
    message: { message: 'Too many authentication attempts from this IP, please try again after an hour' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(globalLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/login', authLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'API is running...' });
});

// Maintenance Middleware
const maintenanceMiddleware = require('./middleware/maintenance.middleware');
const ipEnforcementMiddleware = require('./middleware/ipEnforcement.middleware');

app.use(maintenanceMiddleware);
app.use(ipEnforcementMiddleware);

// Routes
app.use('/api/auth', require('./routes/auth.routes.js'));
app.use('/api/user', require('./routes/user.routes.js'));
app.use('/api/investments', require('./routes/investment.routes.js'));
app.use('/api/products', require('./routes/product.routes.js'));
app.use('/api/opportunities', require('./routes/opportunity.routes.js'));
app.use('/api/community', require('./routes/community.routes.js'));
app.use('/api/admin', require('./routes/admin.routes.js'));
app.use('/api/payments', require('./routes/payment.routes.js'));
app.use('/api/upload', require('./routes/upload.routes.js'));

// Custom Error Handler
const errorHandler = require('./middleware/error');
app.use(errorHandler);

module.exports = app;
