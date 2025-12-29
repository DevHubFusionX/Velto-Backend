const mongoose = require('mongoose');
const dotenv = require('dotenv');
const InvestmentPlan = require('../models/InvestmentPlan');
const connectDB = require('../config/db');

// Load env vars
dotenv.config();

const updatePlans = async () => {
    try {
        await connectDB();
        
        console.log('Clearing old Investment Plans...');
        await InvestmentPlan.deleteMany({});

        const plans = [
            {
                name: 'Starter Plan',
                description: 'Perfect for beginners. Earn 5% daily return for 20 days.',
                minAmount: 5000,
                maxAmount: 49999,
                dailyPayout: 5,
                isPercentage: true,
                durationDays: 20,
                roiDescription: '100% Total ROI',
                status: 'active',
                type: 'Basic Growth',
                risk: 'Low',
                color: '#a3e635' // Lime
            },
            {
                name: 'Silver Plan',
                description: 'Step up your investment. Earn 4% daily return for 25 days.',
                minAmount: 50000,
                maxAmount: 99999,
                dailyPayout: 4,
                isPercentage: true,
                durationDays: 25,
                roiDescription: '100% Total ROI',
                status: 'active',
                type: 'Standard Growth',
                risk: 'Low',
                color: '#94a3b8' // Silver
            },
            {
                name: 'Gold Plan',
                description: 'High value tier. Earn 3% daily return for 34 days.',
                minAmount: 100000,
                maxAmount: 499999,
                dailyPayout: 3,
                isPercentage: true,
                durationDays: 34,
                roiDescription: '102% Total ROI',
                status: 'active',
                type: 'Premium Growth',
                risk: 'Medium',
                color: '#fbbf24' // Gold
            },
            {
                name: 'Platinum Plan',
                description: 'Elite investment tier. Earn 2.5% daily return for 40 days.',
                minAmount: 500000,
                maxAmount: 999999,
                dailyPayout: 2.5,
                isPercentage: true,
                durationDays: 40,
                roiDescription: '100% Total ROI',
                status: 'active',
                type: 'Elite Growth',
                risk: 'Medium',
                color: '#22d3ee' // Cyan/Platinum
            },
            {
                name: 'Diamond Plan',
                description: 'Maximum returns for serious investors. Earn 2% daily return for 50 days.',
                minAmount: 1000000,
                maxAmount: 5000000,
                dailyPayout: 2,
                isPercentage: true,
                durationDays: 50,
                roiDescription: '100% Total ROI',
                status: 'active',
                type: 'Ultimate Growth',
                risk: 'High',
                color: '#818cf8' // Indigo/Diamond
            }
        ];

        console.log('Creating new Investment Plans...');
        await InvestmentPlan.insertMany(plans);

        console.log('Successfully updated Investment Plans!');
        console.log('New Plans:', plans.map(p => p.name).join(', '));
        
        process.exit();
    } catch (err) {
        console.error('Error updating plans:', err);
        process.exit(1);
    }
};

updatePlans();
