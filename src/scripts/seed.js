const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const path = require('path');

// Load env vars from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Load Models
const User = require('../models/User');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');
const InvestmentPlan = require('../models/InvestmentPlan');
const UserInvestment = require('../models/UserInvestment');
const KYC = require('../models/KYC');

const connectDB = require('../config/db');

const seedData = async () => {
    try {
        await connectDB();
        
        // Clear existing data
        await User.deleteMany();
        await Product.deleteMany();
        await Settings.deleteMany();
        await Transaction.deleteMany();
        await Investment.deleteMany();
        await InvestmentPlan.deleteMany();
        await UserInvestment.deleteMany();
        await KYC.deleteMany();

        console.log('Data Cleared...');

        // Create Users
        const users = [];
        
        // 1. Admin User
        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@example.com',
            password: 'password123',
            role: 'admin',
            location: 'Lagos, Nigeria',
            phone: '+234 800 000 0000'
        });
        users.push(admin);

        // 2. Regular User (John Doe - Active)
        const user1 = await User.create({
            name: 'John Doe',
            email: 'user@example.com',
            password: 'password',
            phone: '+234 812 345 6789',
            location: 'Lagos, Nigeria',
            totalBalance: 555000,
            totalInvested: 3100000,
            totalReturns: 456000,
            role: 'user'
        });
        users.push(user1);

        // 3. New User (Jane Smith - Pending KYC)
        const user2 = await User.create({
            name: 'Jane Smith',
            email: 'jane@example.com',
            password: 'password',
            phone: '+234 809 988 7766',
            location: 'Abuja, Nigeria',
            totalBalance: 50000,
            totalInvested: 0,
            role: 'user'
        });
        users.push(user2);

        // 4. Investor User (Michael Brown - High Value)
        const user3 = await User.create({
            name: 'Michael Brown',
            email: 'michael@example.com',
            password: 'password',
            phone: '+234 703 123 4567',
            location: 'Port Harcourt, Nigeria',
            totalBalance: 2500000,
            totalInvested: 15000000,
            totalReturns: 2000000,
            role: 'user'
        });
        users.push(user3);

        console.log('Users Created...');

        // Create KYC Requests
        await KYC.create([
            {
                user: user1._id,
                docType: 'National ID',
                status: 'Approved',
                docNumber: 'NIN123456789',
                frontImage: 'https://via.placeholder.com/300',
                backImage: 'https://via.placeholder.com/300',
                approvedAt: new Date()
            },
            {
                user: user2._id,
                docType: 'Passport',
                status: 'Pending',
                docNumber: 'A12345678',
                frontImage: 'https://via.placeholder.com/300',
                submittedAt: new Date()
            },
            {
                user: user3._id,
                docType: 'Driver License',
                status: 'Rejected',
                docNumber: 'DL987654321',
                frontImage: 'https://via.placeholder.com/300',
                rejectedAt: new Date(),
                adminNotes: 'Image blurry, please re-upload.'
            }
        ]);

        console.log('KYC Requests Created...');

        // Create Products
        const products = await Product.insertMany([
            {
                name: 'Real Estate Fund',
                type: 'Real Estate',
                description: 'Premium real estate investment portfolio.',
                minInvestment: { usd: 1000, ngn: 500000 },
                maxInvestment: { usd: 50000, ngn: 25000000 },
                roi: '12-15%',
                duration: '12 Months',
                durationDays: 365,
                risk: 'Low',
                color: '#a3e635'
            },
            {
                name: 'Tech Startups',
                type: 'Venture Capital',
                description: 'High-growth tech startup fund.',
                minInvestment: { usd: 500, ngn: 250000 },
                maxInvestment: { usd: 10000, ngn: 5000000 },
                roi: '20-25%',
                duration: '24 Months',
                durationDays: 730,
                risk: 'High',
                color: '#84cc16'
            },
            {
                name: 'Agri-Vest',
                type: 'Agriculture',
                description: 'Sustainable agriculture projects.',
                minInvestment: { usd: 100, ngn: 50000 },
                maxInvestment: { usd: 5000, ngn: 2500000 },
                roi: '10-12%',
                duration: '6 Months',
                durationDays: 180,
                risk: 'Low',
                color: '#65a30d'
            }
        ]);

        console.log('Products Created...');

        // Create Investments
        await Investment.create([
            {
                user: user1._id,
                product: products[0]._id,
                amount: 1000000,
                status: 'Active',
                returns: 150000,
                startDate: new Date(),
                endDate: new Date(new Date().setDate(new Date().getDate() + 365))
            },
            {
                user: user3._id,
                product: products[1]._id,
                amount: 5000000,
                status: 'Active',
                returns: 1250000,
                startDate: new Date(),
                endDate: new Date(new Date().setDate(new Date().getDate() + 730))
            }
        ]);

        console.log('Investments Created...');

        // Create Investment Plans (NEW SYSTEM)
        const plans = await InvestmentPlan.create([
            {
                name: 'Daily Growth Plan',
                description: 'Standard daily growth plan with fixed returns.',
                minAmount: 1000,
                maxAmount: 50000,
                dailyPayout: 250, // Fixed amount example
                isPercentage: false,
                durationDays: 30,
                status: 'active',
                type: 'Stocks',
                color: '#60a5fa'
            },
            {
                name: 'VIP Wealth Plan',
                description: 'High yield plan for VIP investors.',
                minAmount: 50000,
                maxAmount: 1000000,
                dailyPayout: 1.5, // 1.5% daily
                isPercentage: true,
                durationDays: 60,
                status: 'active',
                type: 'Crypto',
                color: '#f59e0b'
            },
            {
                name: 'Real Estate Growth',
                description: 'Long-term real estate stability.',
                minAmount: 100000,
                maxAmount: 5000000,
                dailyPayout: 0.8,
                isPercentage: true,
                durationDays: 180,
                status: 'active',
                type: 'Real Estate',
                color: '#a3e635'
            }
        ]);
        console.log('Investment Plans Created...');

        // Create User Investment (NEW SYSTEM) for John Doe
        const invAmount = 5000;
        const payout = plans[0].dailyPayout; // 250
        const invStartDate = new Date();
        const invEndDate = new Date();
        invEndDate.setDate(invStartDate.getDate() + 30);
        const nextDate = new Date();
        nextDate.setDate(invStartDate.getDate() + 1);

        await UserInvestment.create({
            user: user1._id,
            plan: plans[0]._id,
            amount: invAmount,
            dailyPayoutAmount: payout,
            startDate: invStartDate,
            endDate: invEndDate,
            nextPayoutDate: nextDate,
            status: 'active'
        });
        console.log('User Investment Created (New System)...');

        // Create Transactions (Withdrawals & Deposits)
        await Transaction.create([
            {
                user: user1._id,
                type: 'Deposit',
                amount: 500000,
                status: 'Completed',
                reference: 'DEP-' + Date.now() + '1',
                method: 'Bank Transfer'
            },
            {
                user: user2._id,
                type: 'Deposit',
                amount: 50000,
                status: 'Pending',
                reference: 'DEP-' + Date.now() + '2',
                method: 'Card'
            },
            {
                user: user3._id,
                type: 'Withdrawal',
                amount: 200000,
                status: 'Pending',
                reference: 'WTH-' + Date.now() + '3',
                method: 'Bank Transfer',
                description: 'Withdrawal to GTBank'
            },
            {
                user: user1._id,
                type: 'Withdrawal',
                amount: 50000,
                status: 'Completed',
                reference: 'WTH-' + Date.now() + '4',
                method: 'Bank Transfer'
            }
        ]);

        console.log('Transactions Created...');

        // Create Settings
        await Settings.create({
            maintenanceMode: false,
            limits: {
                deposit: { min: { usd: 10, ngn: 5000 }, max: { usd: 10000, ngn: 5000000 } },
                withdrawal: { min: { usd: 10, ngn: 5000 }, max: { usd: 5000, ngn: 2500000 } }
            },
            referralBonus: 5
        });

        console.log('Settings Created...');

        // 8. Create Feature Flags
        const FeatureFlag = require('../models/FeatureFlag');
        await FeatureFlag.deleteMany();
        await FeatureFlag.create([
            {
                key: 'MAINTENANCE_MODE',
                name: 'Maintenance Mode',
                description: 'Toggle to put the site into maintenance mode',
                isEnabled: false
            },
            {
                key: 'REFERRAL_SYSTEM',
                name: 'Referral System',
                description: 'Toggle the visibility of the referral system',
                isEnabled: true
            },
            {
                key: 'REAL_TIME_ALERTS',
                name: 'Real-Time Alerts',
                description: 'Enable/Disable WebSocket notifications',
                isEnabled: true
            }
        ]);
        console.log('Feature Flags Created...');

        console.log('Data Imported Successfully');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedData();
