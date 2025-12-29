const mongoose = require('mongoose');
const dotenv = require('dotenv');
const UserInvestment = require('../models/UserInvestment');
const InvestmentPlan = require('../models/InvestmentPlan');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

dotenv.config();

const debugInvestments = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const users = await User.find();
        console.log(`Found ${users.length} users:`);
        users.forEach(u => console.log(`- ${u.email} | Bal: ${u.totalBalance} | Invested: ${u.totalInvested}`));

        const plans = await InvestmentPlan.find();
        console.log(`Found ${plans.length} investment plans:`);
        plans.forEach(p => console.log(`- ${p.name} (${p._id})`));

        const investments = await UserInvestment.find().populate('plan').populate('user');
        console.log(`Found ${investments.length} user investments:`);
        investments.forEach(inv => {
            console.log(`- User: ${inv.user?.email || 'N/A'} | Plan: ${inv.plan?.name || 'N/A'} | Amount: ${inv.amount} | Status: ${inv.status} | CreatedAt: ${inv.createdAt}`);
        });

        const transactions = await Transaction.find().populate('user');
        console.log(`Found ${transactions.length} transactions:`);
        transactions.forEach(t => {
            console.log(`- User: ${t.user?.email || 'N/A'} | Type: ${t.type} | Amount: ${t.amount} | Ref: ${t.reference} | Date: ${t.date}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

debugInvestments();
