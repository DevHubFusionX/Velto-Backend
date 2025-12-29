const Product = require('../models/Product');
const Investment = require('../models/Investment');
const InvestmentPlan = require('../models/InvestmentPlan');
const UserInvestment = require('../models/UserInvestment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');

const investmentController = {
  // Legacy methods (keeping for backward compatibility or existing frontend parts)
  getAll: async (req, res) => {
    try {
        const investments = await Investment.find({ user: req.user.id });
        res.json(investments);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching investments' });
    }
  },

  getById: async (req, res) => {
    try {
        const investment = await Investment.findOne({ _id: req.params.id, user: req.user.id });
        if (!investment) return res.status(404).json({ message: 'Investment not found' });
        res.json(investment);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching investment' });
    }
  },

  create: async (req, res) => {
      res.status(501).json({ message: 'Please use /user/invest endpoint' });
  },

  getProducts: async (req, res) => {
    try {
        const plans = await InvestmentPlan.find({ status: 'active' });
        
        // Map InvestmentPlan to Product structure for frontend compatibility
        const products = plans.map(plan => ({
            _id: plan._id,
            id: plan._id,
            name: plan.name,
            type: plan.type,
            description: plan.description,
            minInvestment: {
                usd: plan.minAmount,
                ngn: plan.minAmount // Fallback for legacy UI if needed
            },
            maxInvestment: {
                usd: plan.maxAmount,
                ngn: plan.maxAmount // Fallback for legacy UI if needed
            },
            minAmount: plan.minAmount,
            maxAmount: plan.maxAmount,
            dailyPayout: plan.dailyPayout,
            isPercentage: plan.isPercentage,
            durationDays: plan.durationDays,
            roi: plan.roiDescription || `${plan.dailyPayout}${plan.isPercentage ? '%' : ''} Daily`,
            roiType: plan.isPercentage ? 'Percentage' : 'Fixed',
            duration: `${plan.durationDays} Days`,
            risk: plan.risk,
            status: plan.status,
            color: plan.color || '#a3e635', // Default color if not present
            popular: false
        }));

        res.json(products);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ message: 'Error fetching products' });
    }
  },

  getOpportunities: async (req, res) => {
    try {
        const opportunities = await Product.find(); 
        res.json(opportunities);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching opportunities' });
    }
  },

  // --- NEW INVESTMENT SYSTEM METHODS ---

  // @desc    Create a new investment plan (Admin)
  createPlan: async (req, res) => {
    try {
        const plan = await InvestmentPlan.create(req.body);
        res.status(201).json({ success: true, data: plan });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
  },

  // @desc    Get all active investment plans (Public)
  getPlans: async (req, res) => {
    try {
        const plans = await InvestmentPlan.find({ status: 'active' });
        res.status(200).json({ success: true, data: plans });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
  },

  // @desc    Get ALL investment plans (Admin)
  getAllPlans: async (req, res) => {
    try {
        const plans = await InvestmentPlan.find().sort({ createdAt: -1 });

        // Aggregate investor counts
        const investorCounts = await UserInvestment.aggregate([
            { $group: { _id: "$plan", uniqueUsers: { $addToSet: "$user" } } },
            { $project: { planId: "$_id", count: { $size: "$uniqueUsers" } } }
        ]);

        const plansWithStats = plans.map(plan => {
            const stats = investorCounts.find(s => s._id.toString() === plan._id.toString());
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

  // @desc    Update an investment plan (Admin)
  updatePlan: async (req, res) => {
    try {
        const plan = await InvestmentPlan.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }
        res.status(200).json({ success: true, data: plan });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
  },

  // @desc    Delete an investment plan (Admin)
  deletePlan: async (req, res) => {
    try {
        const plan = await InvestmentPlan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }
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
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }
        // Toggle between active and inactive, or set specific status if provided
        plan.status = req.body.status || (plan.status === 'active' ? 'inactive' : 'active');
        await plan.save();
        res.status(200).json({ success: true, data: plan });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
  },

  // @desc    User invests in a plan
  invest: async (req, res) => {
    console.log('--- NEW SYSTEM INVEST CALLED ---');
    const { planId, productId, amount } = req.body;
    const targetId = planId || productId;
    console.log('Payload:', req.body);

    try {
        const plan = await InvestmentPlan.findById(targetId);
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (amount < plan.minAmount || amount > plan.maxAmount) {
            return res.status(400).json({ success: false, error: `Amount must be between ${plan.minAmount} and ${plan.maxAmount}` });
        }

        if (user.totalBalance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient funds' });
        }

        // Deduct amount
        user.totalBalance -= amount;
        user.totalInvested += amount;
        await user.save();

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

        // Transaction Record
        await Transaction.create({
            user: req.user.id,
            type: 'Investment',
            amount: -amount, // Should be negative as it's a deduction
            status: 'Completed',
            reference: `INV-INIT-${investment._id}`,
            description: `Investment in plan: ${plan.name}`
        });

        // --- NEW STRICT REFERRAL BONUS LOGIC ---
        if (user.referredBy) {
            const settings = await Settings.findOne();
            const config = settings?.referral || {
                rewardPercent: 3,
                maxRewardPerReferral: 5000,
                maxReferralsLifetime: 50,
                maxEarningsLifetime: 100000,
                unlockDays: 14
            };

            const legacyCount = await Investment.countDocuments({ user: user._id });
            const newCount = await UserInvestment.countDocuments({ user: user._id });
            
            // Triggered ONLY on user's VERY FIRST investment on the platform
            if (legacyCount + newCount === 1) {
                const referrer = await User.findById(user.referredBy);
                
                if (referrer) {
                    // 1. Eligibility Checks for Referrer
                    const isVerified = referrer.isEmailVerified;
                    const hasInvestment = (await Investment.exists({ user: referrer._id })) || 
                                        (await UserInvestment.exists({ user: referrer._id }));
                    
                    // 2. Platform Limit Checks
                    const withinRefLimit = referrer.referralCount < config.maxReferralsLifetime;
                    const withinEarnLimit = referrer.lifetimeReferralEarnings < config.maxEarningsLifetime;

                    if (isVerified && hasInvestment && withinRefLimit && withinEarnLimit) {
                        // 3. Calculate Reward
                        let rawReward = (amount * config.rewardPercent) / 100;
                        let finalReward = Math.min(rawReward, config.maxRewardPerReferral);
                        
                        // Ensure we don't exceed the lifetime cap with THIS reward
                        if (referrer.lifetimeReferralEarnings + finalReward > config.maxEarningsLifetime) {
                            finalReward = config.maxEarningsLifetime - referrer.lifetimeReferralEarnings;
                        }

                        if (finalReward > 0) {
                            const unlockDate = new Date();
                            unlockDate.setDate(unlockDate.getDate() + (config.unlockDays || 14));

                            // 4. Record Pending Reward
                            await Transaction.create({
                                user: referrer._id,
                                type: 'Referral',
                                amount: finalReward,
                                status: 'Pending', // Locked until matured
                                unlockDate: unlockDate,
                                reference: `REF-PENDING-${user._id}-${Date.now()}`,
                                description: `Pending referral reward (3%) for ${user.name}'s first investment`
                            });

                            // 5. Update Referrer's Tracking Stats
                            referrer.referralBalance += finalReward;
                            referrer.referralCount += 1;
                            referrer.lifetimeReferralEarnings += finalReward;
                            await referrer.save();

                            console.log(`[REFERRAL] ✅ Pending reward of ${finalReward} logged for Referrer: ${referrer.email}`);
                        }
                    } else {
                        console.log(`[REFERRAL] ❌ Referrer ${referrer.email} ineligible: Verified:${isVerified}, HasInv:${hasInvestment}, RefLimit:${withinRefLimit}, EarnLimit:${withinEarnLimit}`);
                    }
                }
            }
        }

        res.status(201).json({ success: true, data: investment });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
  },

  // @desc    Get logged in user's new system investments
  getMyInvestments: async (req, res) => {
    try {
        const investments = await UserInvestment.find({ user: req.user.id }).populate('plan');
        res.status(200).json({ success: true, data: investments });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
  },

  // @desc    Get all active investments (Admin)
  getAllInvestments: async (req, res) => {
    try {
        const investments = await UserInvestment.find().populate('user').populate('plan');
        res.status(200).json({ success: true, data: investments });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
  }
};

module.exports = investmentController;
