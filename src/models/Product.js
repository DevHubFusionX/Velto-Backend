const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String, // e.g., 'Real Estate', 'Crypto'
        required: true
    },
    description: String,
    minInvestment: {
        usd: Number,
        ngn: Number
    },
    maxInvestment: {
        usd: Number,
        ngn: Number
    },
    roi: {
        type: String, // e.g., "12-15%"
        required: true
    },
    duration: String, // e.g., "6 Months"
    durationDays: Number,
    risk: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Very High'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'sold_out'],
        default: 'active'
    },
    color: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Product', productSchema);
