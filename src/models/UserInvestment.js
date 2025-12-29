const mongoose = require('mongoose');

const userInvestmentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InvestmentPlan',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    dailyPayoutAmount: {
        type: Number, 
        required: true
        // Calculated at moment of investment to freeze the return logic
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    nextPayoutDate: {
        type: Date,
        required: true
    },
    totalPayoutReceived: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'terminated'],
        default: 'active'
    },
    terminatedAt: Date,
    terminationReason: String,
    penaltyAmount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Optimization Indexes
userInvestmentSchema.index({ user: 1, status: 1 });
userInvestmentSchema.index({ nextPayoutDate: 1 });
userInvestmentSchema.index({ endDate: 1 });

module.exports = mongoose.model('UserInvestment', userInvestmentSchema);
