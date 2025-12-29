const mongoose = require('mongoose');

const investmentPlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: String,
    minAmount: {
        type: Number,
        required: true
    },
    maxAmount: {
        type: Number,
        required: true
    },
    // If true, dailyPayout is a %, otherwise it's a fixed amount
    isPercentage: {
        type: Boolean,
        default: true
    },
    dailyPayout: {
        type: Number, 
        required: true,
        // e.g., 1.5 for 1.5% or 250 for 250 fixed
    },
    durationDays: {
        type: Number,
        required: true
    },
    // Visual / UI Fields
    type: {
        type: String,
        default: 'General Growth' 
    },
    risk: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    color: {
        type: String,
        default: '#a3e635'
    },
    roiDescription: {
        type: String, // e.g. "12-15%" used for display, separate from calculated dailyPayout
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('InvestmentPlan', investmentPlanSchema);
