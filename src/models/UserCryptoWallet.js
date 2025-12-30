const mongoose = require('mongoose');
const crypto = require('crypto');

const CRYPTO_CURRENCIES = ['BTC', 'ETH', 'BNB', 'LTC', 'USDT_TRC20', 'USDT_ERC20'];

const userCryptoWalletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
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
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for user + currency lookup
userCryptoWalletSchema.index({ user: 1, currency: 1 }, { unique: true });

// Static method to generate a simulated wallet address
userCryptoWalletSchema.statics.generateAddress = function (currency, userId) {
    const hash = crypto.createHash('sha256')
        .update(`${userId}-${currency}-${Date.now()}-${Math.random()}`)
        .digest('hex');

    // Format address based on currency type
    switch (currency) {
        case 'BTC':
            return '1' + hash.substring(0, 33); // Bitcoin-like format
        case 'LTC':
            return 'L' + hash.substring(0, 33); // Litecoin-like format
        case 'ETH':
        case 'BNB':
        case 'USDT_ERC20':
            return '0x' + hash.substring(0, 40); // Ethereum-like format
        case 'USDT_TRC20':
            return 'T' + hash.substring(0, 33); // Tron-like format
        default:
            return hash.substring(0, 42);
    }
};

// Static method to get network for currency
userCryptoWalletSchema.statics.getNetwork = function (currency) {
    const networkMap = {
        'BTC': 'Bitcoin',
        'ETH': 'Ethereum',
        'BNB': 'BEP20',
        'LTC': 'Litecoin',
        'USDT_TRC20': 'TRC20',
        'USDT_ERC20': 'ERC20'
    };
    return networkMap[currency] || 'Unknown';
};

// Static method to create wallets for a new user
userCryptoWalletSchema.statics.createWalletsForUser = async function (userId) {
    const wallets = [];

    for (const currency of CRYPTO_CURRENCIES) {
        const address = this.generateAddress(currency, userId);
        const network = this.getNetwork(currency);

        const wallet = await this.create({
            user: userId,
            currency,
            address,
            network
        });
        wallets.push(wallet);
    }

    return wallets;
};

module.exports = mongoose.model('UserCryptoWallet', userCryptoWalletSchema);
