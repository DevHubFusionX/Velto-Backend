/**
 * Seed script for initializing crypto wallets and settings
 * Run with: node src/scripts/seedCrypto.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const CryptoWallet = require('../models/CryptoWallet');
const Settings = require('../models/Settings');

const ADMIN_WALLETS = [
    {
        currency: 'BTC',
        address: 'REPLACE_WITH_YOUR_BTC_ADDRESS',
        network: 'Bitcoin',
        label: 'Bitcoin Wallet',
        isActive: true
    },
    {
        currency: 'ETH',
        address: 'REPLACE_WITH_YOUR_ETH_ADDRESS',
        network: 'Ethereum',
        label: 'Ethereum Wallet',
        isActive: true
    },
    {
        currency: 'BNB',
        address: 'REPLACE_WITH_YOUR_BNB_ADDRESS',
        network: 'BEP20',
        label: 'BNB Wallet',
        isActive: true
    },
    {
        currency: 'LTC',
        address: 'REPLACE_WITH_YOUR_LTC_ADDRESS',
        network: 'Litecoin',
        label: 'Litecoin Wallet',
        isActive: true
    },
    {
        currency: 'USDT_TRC20',
        address: 'REPLACE_WITH_YOUR_USDT_TRC20_ADDRESS',
        network: 'TRC20',
        label: 'USDT (TRC20) Wallet',
        isActive: true
    },
    {
        currency: 'USDT_ERC20',
        address: 'REPLACE_WITH_YOUR_USDT_ERC20_ADDRESS',
        network: 'ERC20',
        label: 'USDT (ERC20) Wallet',
        isActive: true
    }
];

const seedCrypto = async () => {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        // Seed admin crypto wallets
        console.log('\n📍 Seeding admin crypto wallets...');
        for (const wallet of ADMIN_WALLETS) {
            const existing = await CryptoWallet.findOne({ currency: wallet.currency });
            if (existing) {
                console.log(`  ⏭️  ${wallet.currency} wallet already exists, skipping...`);
            } else {
                await CryptoWallet.create(wallet);
                console.log(`  ✅ Created ${wallet.currency} wallet`);
            }
        }

        // Update Settings with crypto configuration
        console.log('\n⚙️  Updating crypto settings...');
        const settings = await Settings.findOne();
        if (settings) {
            if (!settings.crypto) {
                settings.crypto = {
                    enabled: true,
                    supportedCurrencies: ['BTC', 'ETH', 'BNB', 'LTC', 'USDT_TRC20', 'USDT_ERC20'],
                    depositMinUsd: 10,
                    depositMaxUsd: 100000,
                    withdrawalMinUsd: 20,
                    withdrawalMaxUsd: 50000
                };
                await settings.save();
                console.log('  ✅ Crypto settings added to existing settings');
            } else {
                console.log('  ⏭️  Crypto settings already exist');
            }
        } else {
            await Settings.create({
                maintenanceMode: false,
                limits: {
                    deposit: { min: { usd: 10, ngn: 5000 }, max: { usd: 100000, ngn: 50000000 } },
                    withdrawal: { min: { usd: 20, ngn: 10000 }, max: { usd: 50000, ngn: 25000000 } }
                },
                crypto: {
                    enabled: true,
                    supportedCurrencies: ['BTC', 'ETH', 'BNB', 'LTC', 'USDT_TRC20', 'USDT_ERC20'],
                    depositMinUsd: 10,
                    depositMaxUsd: 100000,
                    withdrawalMinUsd: 20,
                    withdrawalMaxUsd: 50000
                }
            });
            console.log('  ✅ Created new settings with crypto config');
        }

        console.log('\n🎉 Crypto seeding complete!');
        console.log('\n⚠️  IMPORTANT: Replace the placeholder wallet addresses with your actual addresses!');
        console.log('   You can do this via the Admin Panel → Platform Settings → Crypto Wallets');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedCrypto();
