const InvestmentPlan = require('../models/InvestmentPlan');
const UserInvestment = require('../models/UserInvestment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @desc    Create a new investment plan
// @route   POST /api/investments/plans
// @access  Admin
exports.createPlan = async (req, res) => {
    try {
        const plan = await InvestmentPlan.create(req.body);
        res.status(201).json({ success: true, data: plan });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get all active investment plans
// @route   GET /api/investments/plans
// @access  Public
exports.getPlans = async (req, res) => {
    try {
        const plans = await InvestmentPlan.find({ status: 'active' });
        res.status(200).json({ success: true, data: plans });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    User invests in a plan
// @route   POST /api/investments/invest
// @access  Private
exports.invest = async (req, res) => {
    const { planId, amount } = req.body;

    try {
        const plan = await InvestmentPlan.findById(planId);
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // 1. Validation
        if (amount < plan.minAmount || amount > plan.maxAmount) {
            return res.status(400).json({ success: false, error: `Amount must be between ${plan.minAmount} and ${plan.maxAmount}` });
        }

        if (user.totalBalance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient funds' });
        }

        // 2. Deduct amount from user wallet
        user.totalBalance -= amount;
        user.totalInvested += amount;
        await user.save();

        // 3. Create Investment Record
        // Calculate daily payout
        let dailyPayoutAmount;
        if (plan.isPercentage) {
            dailyPayoutAmount = (amount * plan.dailyPayout) / 100;
        } else {
            dailyPayoutAmount = plan.dailyPayout;
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + plan.durationDays);
        
        const nextPayoutDate = new Date();
        nextPayoutDate.setDate(startDate.getDate() + 1); // Starts tomorrow

        const investment = await UserInvestment.create({
            user: req.user.id,
            plan: plan._id,
            amount,
            dailyPayoutAmount,
            startDate,
            endDate,
            nextPayoutDate,
            status: 'active'
        });

        // 4. Create Transaction Record (Expense)
        await Transaction.create({
            user: req.user.id,
            type: 'Investment',
            amount: amount,
            status: 'Completed',
            reference: `INV-INIT-${investment._id}`,
            description: `Investment in plan: ${plan.name}`
        });

        res.status(201).json({ success: true, data: investment });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get logged in user's investments
// @route   GET /api/investments/my
// @access  Private
exports.getMyInvestments = async (req, res) => {
    try {
        const investments = await UserInvestment.find({ user: req.user.id }).populate('plan');
        res.status(200).json({ success: true, data: investments });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get all user investments (Admin)
// @route   GET /api/investments/all
// @access  Admin
exports.getAllInvestments = async (req, res) => {
    try {
        const investments = await UserInvestment.find().populate('user').populate('plan');
        res.status(200).json({ success: true, data: investments });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};
