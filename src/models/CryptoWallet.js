const mongoose = require('mongoose');

const CRYPTO_CURRENCIES = ['BTC', 'ETH', 'BNB', 'LTC', 'USDT_TRC20', 'USDT_ERC20'];
const NETWORKS = ['Bitcoin', 'Ethereum', 'BEP20', 'Litecoin', 'TRC20', 'ERC20'];

const cryptoWalletSchema = new mongoose.Schema({
    currency: {
        type: String,
        enum: CRYPTO_CURRENCIES,
        required: true
    },
    address: {
        type: String,
        required: true,
        unique: true
    },
    network: {
        type: String,
        enum: NETWORKS,
        required: true
    },
    label: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for quick lookup by currency
cryptoWalletSchema.index({ currency: 1, isActive: 1 });

// Export constants for reuse
cryptoWalletSchema.statics.CRYPTO_CURRENCIES = CRYPTO_CURRENCIES;
cryptoWalletSchema.statics.NETWORKS = NETWORKS;

module.exports = mongoose.model('CryptoWallet', cryptoWalletSchema);
