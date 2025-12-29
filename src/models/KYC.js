const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    docType: {
        type: String,
        enum: ['Passport', 'Driver License', 'National ID', 'Email Verification'],
        required: true
    },
    docNumber: String,
    frontImage: String,
    backImage: String,
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    submittedAt: {
        type: Date,
        default: Date.now
    },
    approvedAt: Date,
    rejectedAt: Date,
    adminNotes: String
});

module.exports = mongoose.model('KYC', kycSchema);
