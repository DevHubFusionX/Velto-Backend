const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { runDailyPayouts } = require('../services/cronService');

dotenv.config();

const trigger = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        console.log('--- Starting Manual Payout Trigger ---');
        await runDailyPayouts();
        console.log('--- Manual Payout Trigger Completed ---');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

trigger();
