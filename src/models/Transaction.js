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
        default: 'USD' // Internal base currency for crypto value tracking
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
    },
    // Payment Verification Fields
    proofUrl: String,
    verifiedAt: Date,
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    requestedAmount: Number, // Original amount user asked for (if different from final verified amount)
    gatewayReference: String, // External reference (Paystack ID, etc)

    // Crypto Transaction Fields
    isCrypto: {
        type: Boolean,
        default: false
    },
    cryptoCurrency: {
        type: String,
        enum: ['BTC', 'ETH', 'BNB', 'LTC', 'USDT_TRC20', 'USDT_ERC20', null],
        default: null
    },
    cryptoAmount: Number, // Amount in cryptocurrency
    cryptoAddress: String, // Destination wallet address (for withdrawals)
    txHash: String, // Blockchain transaction hash
    network: String, // Blockchain network (Bitcoin, Ethereum, BEP20, etc.)

    // NOWPayments Specific Fields
    paymentId: String,
    payAddress: String,
    payAmount: Number,
    actuallyPaid: Number,
    paymentStatus: String
});

// Optimization Indexes
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
