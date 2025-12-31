const mongoose = require('mongoose');

/**
 * Settings Schema - Crypto Only Platform
 * Fiat (NGN/USD) limits have been removed
 * All transactions are crypto-based
 */
const settingsSchema = new mongoose.Schema({
    maintenanceMode: {
        type: Boolean,
        default: false
    },

    referral: {
        rewardPercent: { type: Number, default: 3 },
        maxRewardPerReferral: { type: Number, default: 100 }, // In USD equivalent
        maxReferralsLifetime: { type: Number, default: 50 },
        maxEarningsLifetime: { type: Number, default: 10000 }, // In USD equivalent
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

    // Crypto Settings (Primary configuration)
    crypto: {
        enabled: { type: Boolean, default: true },
        supportedCurrencies: {
            type: [String],
            default: ['BTC', 'ETH', 'BNB', 'USDT_TRC20', 'USDT_ERC20']
        },
        depositMinUsd: { type: Number, default: 15 },
        depositMaxUsd: { type: Number, default: 100000 },
        withdrawalMinUsd: { type: Number, default: 20 },
        withdrawalMaxUsd: { type: Number, default: 50000 }
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Settings', settingsSchema);
