const app = require('./src/app');
const dotenv = require('dotenv');

dotenv.config();

const validateEnv = require('./src/config/validateEnv');
// Validate Env Vars
validateEnv();

const connectDB = require('./src/config/db');
const { initializeScheduler } = require('./src/services/payout.scheduler');
const { verifyConnection } = require('./src/services/email/emailConfig');

const http = require('http');
const { initializeSocket } = require('./src/socket');

// Connect to Database
connectDB();

// Verify Email Service Connection
verifyConnection();

// Initialize Payout Scheduler
initializeScheduler();

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
