const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    productName: String, // Snapshot of name in case product changes
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'NGN'
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    maturityDate: Date,
    status: {
        type: String,
        enum: ['Active', 'Completed', 'Terminated'],
        default: 'Active'
    },
    currentValue: Number,
    roiPercent: Number, // Snapshot
    payoutFrequency: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Investment', investmentSchema);
