const Product = require('../../models/Product');
const Investment = require('../../models/Investment');
const UserInvestment = require('../../models/UserInvestment');
const InvestmentPlan = require('../../models/InvestmentPlan');
const Payout = require('../../models/Payout');
const { triggerManualPayout } = require('../../services/payout.scheduler');

const investmentController = {
    // @desc    Create a new investment plan (Admin)
    createInvestmentPlan: async (req, res) => {
        try {
            // Support both legacy 'plan' object and flat body
            const planData = req.body.plan || req.body;
            const plan = await InvestmentPlan.create(planData);
            res.status(201).json({ success: true, message: 'Plan created successfully', data: plan });
        } catch (err) {
            console.error('Error creating plan:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },

    // @desc    Update an investment plan (Admin)
    updatePlan: async (req, res) => {
        try {
            const plan = await InvestmentPlan.findByIdAndUpdate(req.params.id, req.body, {
                new: true,
                runValidators: true
            });
            if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });
            res.status(200).json({ success: true, data: plan });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    },

    // @desc    Delete an investment plan (Admin)
    deletePlan: async (req, res) => {
        try {
            const plan = await InvestmentPlan.findById(req.params.id);
            if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });
            await plan.deleteOne();
            res.status(200).json({ success: true, data: {} });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    },

    // @desc    Toggle investment plan status (Admin)
    togglePlanStatus: async (req, res) => {
        try {
            const plan = await InvestmentPlan.findById(req.params.id);
            if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });
            plan.status = req.body.status || (plan.status === 'active' ? 'inactive' : 'active');
            await plan.save();
            res.status(200).json({ success: true, data: plan });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    },

    // @desc    Get ALL investment plans with investor stats (Admin)
    getAllPlans: async (req, res) => {
        try {
            const plans = await InvestmentPlan.find().sort({ createdAt: -1 });

            const investorCounts = await UserInvestment.aggregate([
                { $group: { _id: "$plan", uniqueUsers: { $addToSet: "$user" } } },
                { $project: { planId: "$_id", count: { $size: "$uniqueUsers" } } }
            ]);

            const plansWithStats = plans.map(plan => {
                const stats = investorCounts.find(s => s.planId?.toString() === plan._id.toString());
                return {
                    ...plan.toObject(),
                    investorsCount: stats ? stats.count : 0
                };
            });

            res.status(200).json({ success: true, data: plansWithStats });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    },

    // @desc    Get all active investments across all users (Admin)
    getAllInvestments: async (req, res) => {
        try {
            const [newInvestments, legacyInvestments] = await Promise.all([
                UserInvestment.find().populate('user', 'name email').populate('plan'),
                Investment.find().populate('user', 'name email')
            ]);

            // Map legacy investments for Admin UI compatibility
            const mappedLegacy = legacyInvestments.map(inv => ({
                ...inv.toObject(),
                plan: {
                    name: inv.productName || 'Legacy Product'
                },
                dailyPayoutAmount: 0 // Legacy didn't have daily payouts in the same way
            }));

            res.status(200).json({
                success: true,
                data: [...newInvestments, ...mappedLegacy]
            });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    },

    getInvestmentAnalytics: async (req, res) => {
        try {
            const [activeNew, activeLegacy] = await Promise.all([
                UserInvestment.find({ status: 'active' }),
                Investment.find({ status: 'Active' }) // Legacy uses 'Active' (capitalized)
            ]);

            const totalLocked = [...activeNew, ...activeLegacy].reduce((sum, inv) => sum + inv.amount, 0);

            const allPayouts = await Payout.find({});
            const totalPaid = allPayouts.reduce((sum, p) => sum + p.amount, 0);

            // Distribution by plan (consolidated)
            const distribution = await UserInvestment.aggregate([
                { $match: { status: 'active' } },
                { $group: { _id: '$plan', total: { $sum: '$amount' }, count: { $sum: 1 } } },
                { $lookup: { from: 'investmentplans', localField: '_id', foreignField: '_id', as: 'planDetails' } },
                { $unwind: '$planDetails' },
                { $project: { planName: '$planDetails.name', total: 1, count: 1 } }
            ]);

            // Add legacy distribution
            const legacyDist = await Investment.aggregate([
                { $match: { status: 'Active' } },
                { $group: { _id: '$productName', total: { $sum: '$amount' }, count: { $sum: 1 } } },
                { $project: { planName: '$_id', total: 1, count: 1 } }
            ]);

            const recentPayouts = await Payout.find({})
                .populate('user', 'name email')
                .populate({
                    path: 'investment',
                    populate: { path: 'plan' }
                })
                .sort({ date: -1 })
                .limit(20);

            res.json({
                totalLocked,
                totalPaid,
                activeCount: activeNew.length + activeLegacy.length,
                completedCount: await UserInvestment.countDocuments({ status: 'completed' }),
                terminatedCount: await UserInvestment.countDocuments({ status: 'terminated' }),
                distribution: [...distribution, ...legacyDist],
                recentPayouts
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching investment analytics' });
        }
    },

    triggerPayouts: async (req, res) => {
        try {
            await triggerManualPayout();
            res.json({ message: 'Payout process triggered successfully' });
        } catch (err) {
            res.status(500).json({ message: 'Error triggering payouts' });
        }
    },

    getPayoutLogs: async (req, res) => {
        try {
            const { limit = 100 } = req.query;
            const logs = await Payout.find({})
                .populate('user', 'name email')
                .populate('investment')
                .sort({ date: -1 })
                .limit(parseInt(limit));

            res.json(logs);
        } catch (err) {
            res.status(500).json({ message: 'Error fetching payout logs' });
        }
    },

    getProductsWithStats: async (req, res) => {
        try {
            const products = await Product.find();
            const investmentCounts = await Investment.aggregate([
                { $match: { status: 'Active' } },
                { $group: { _id: '$product', count: { $sum: 1 } } }
            ]);

            const countMap = {};
            investmentCounts.forEach(item => {
                countMap[item._id.toString()] = item.count;
            });

            const productsWithStats = products.map(p => ({
                ...p.toObject(),
                investorCount: countMap[p._id.toString()] || 0
            }));

            res.json(productsWithStats);
        } catch (err) {
            res.status(500).json({ message: 'Error fetching legacy products' });
        }
    }
};

module.exports = investmentController;
