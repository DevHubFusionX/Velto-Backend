const mongoose = require('mongoose');
const dotenv = require('dotenv');
const InvestmentPlan = require('../models/InvestmentPlan');

dotenv.config();

const plans = [
    {
        name: 'Real Estate Fund',
        type: 'Real Estate',
        description: 'Secure investment in premium residential and commercial properties.',
        minAmount: 500000,
        maxAmount: 50000000,
        isPercentage: true,
        dailyPayout: 0.5, // Approx 15% monthly / 30 days
        roiDescription: '12-15%',
        durationDays: 365, // 12 Months
        risk: 'Low',
        status: 'active'
    },
    {
        name: 'Tech Startups',
        type: 'Venture Capital',
        description: 'High-growth potential investments in emerging technology companies.',
        minAmount: 250000,
        maxAmount: 25000000,
        isPercentage: true,
        dailyPayout: 0.8, // Approx 24% monthly
        roiDescription: '20-25%',
        durationDays: 730, // 24 Months
        risk: 'High',
        status: 'active'
    },
    {
        name: 'Agri-Vest',
        type: 'Agriculture',
        description: 'Sustainable agricultural investments with stable returns.',
        minAmount: 50000,
        maxAmount: 5000000,
        isPercentage: true,
        dailyPayout: 0.4, // Approx 12% monthly
        roiDescription: '10-12%',
        durationDays: 180, // 6 Months
        risk: 'Low',
        status: 'active'
    }
];

const seedInvestments = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        // Clear existing plans to avoid duplicates/confusion for this specific request
        await InvestmentPlan.deleteMany({});
        console.log('Cleared existing plans');

        await InvestmentPlan.insertMany(plans);
        console.log('Investment Plans Seeded Successfully');

        process.exit();
    } catch (error) {
        console.error('Error seeding plans:', error);
        process.exit(1);
    }
};

seedInvestments();
