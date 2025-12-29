const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    investment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserInvestment',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['daily', 'completion', 'withdrawal'],
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    notes: String
});

// Index for efficient queries
payoutSchema.index({ user: 1, date: -1 });
payoutSchema.index({ investment: 1 });

module.exports = mongoose.model('Payout', payoutSchema);
