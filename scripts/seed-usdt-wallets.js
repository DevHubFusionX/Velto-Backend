/**
 * Seed USDT-only wallets and update platform settings
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CryptoWallet = require('../src/models/CryptoWallet');
const Settings = require('../src/models/Settings');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // Clear old non-USDT wallets
    const deleted = await CryptoWallet.deleteMany({ currency: { $nin: ['USDT_TRC20', 'USDT_ERC20'] } });
    console.log(`🗑  Removed ${deleted.deletedCount} non-USDT wallets`);

    // Upsert USDT wallets — replace addresses with your real ones
    const wallets = [
        { currency: 'USDT_TRC20', network: 'TRC20', label: 'USDT TRC20 Deposit Wallet', address: process.env.USDT_TRC20_ADDRESS || 'REPLACE_WITH_YOUR_TRC20_ADDRESS' },
        { currency: 'USDT_ERC20', network: 'ERC20', label: 'USDT ERC20 Deposit Wallet', address: process.env.USDT_ERC20_ADDRESS || 'REPLACE_WITH_YOUR_ERC20_ADDRESS' }
    ];

    for (const w of wallets) {
        await CryptoWallet.findOneAndUpdate(
            { currency: w.currency },
            { ...w, isActive: true, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        console.log(`✅ ${w.currency} wallet set: ${w.address}`);
    }

    // Update settings to USDT only
    await Settings.findOneAndUpdate(
        {},
        { $set: { 'crypto.supportedCurrencies': ['USDT_TRC20', 'USDT_ERC20'], 'crypto.enabled': true } },
        { upsert: true }
    );
    console.log('✅ Settings updated — USDT only');

    await mongoose.disconnect();
    console.log('\nDone. Update USDT_TRC20_ADDRESS and USDT_ERC20_ADDRESS in your .env file.');
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
