const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    maintenanceMode: {
        type: Boolean,
        default: false
    },
    limits: {
        deposit: {
            min: { usd: Number, ngn: Number },
            max: { usd: Number, ngn: Number }
        },
        withdrawal: {
            min: { usd: Number, ngn: Number },
            max: { usd: Number, ngn: Number }
        }
    },
    referral: {
        rewardPercent: { type: Number, default: 3 },
        maxRewardPerReferral: { type: Number, default: 5000 },
        maxReferralsLifetime: { type: Number, default: 50 },
        maxEarningsLifetime: { type: Number, default: 100000 },
        unlockDays: { type: Number, default: 14 },
        activeInvestmentRequired: { type: Boolean, default: true }
    },
    securityProtocols: {
        enforce2fa: { type: Boolean, default: false },
        ipWhitelisting: { type: Boolean, default: false },
        ipWhitelist: { type: [String], default: [] },
        auditLogsEnabled: { type: Boolean, default: true },
        sensitiveActionConfirm: { type: Boolean, default: true }
    },
    failedLoginAttempts: { type: Number, default: 0 },
    referralBonus: { type: Number, default: 2500 }, // Legacy field, kept for compatibility
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Settings', settingsSchema);
