const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String, // 'Deposit', 'Withdrawal', 'Investment', 'Return'
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'NGN'
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Rejected', 'Failed'],
        default: 'Pending'
    },
    reference: {
        type: String,
        required: true,
        unique: true
    },
    method: String, // 'Card', 'Bank Transfer', etc.
    description: String,
    date: {
        type: Date,
        default: Date.now
    },
    unlockDate: { // For referral rewards maturation
        type: Date
    }
});

// Optimization Indexes
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
