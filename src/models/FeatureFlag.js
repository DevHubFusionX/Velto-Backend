const mongoose = require('mongoose');

const featureFlagSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    isEnabled: {
        type: Boolean,
        default: false
    },
    rules: {
        type: mongoose.Schema.Types.Mixed,
        default: {} // Can store complex rules like { roles: ['admin'], percent: 50 }
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Optimization Index


module.exports = mongoose.model('FeatureFlag', featureFlagSchema);
