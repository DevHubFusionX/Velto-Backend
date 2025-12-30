const Settings = require('../../models/Settings');
const { logSecurityEvent } = require('../../utils/logger');

const settingsController = {
    getSettings: async (req, res) => {
        try {
            let settings = await Settings.findOne();
            if (!settings) {
                settings = await Settings.create({
                    maintenanceMode: false,
                    limits: {
                        deposit: {
                            min: { usd: 100, ngn: 100000 },
                            max: { usd: 100000, ngn: 100000000 }
                        },
                        withdrawal: {
                            min: { usd: 50, ngn: 50000 },
                            max: { usd: 50000, ngn: 50000000 }
                        }
                    },
                    referral: {
                        rewardPercent: 3,
                        maxRewardPerReferral: 5000,
                        maxReferralsLifetime: 50,
                        maxEarningsLifetime: 100000,
                        unlockDays: 14,
                        activeInvestmentRequired: true
                    },
                    referralBonus: 2500,
                    updatedAt: Date.now()
                });
            } else if (!settings.referral) {
                settings.referral = {
                    rewardPercent: 3,
                    maxRewardPerReferral: 5000,
                    maxReferralsLifetime: 50,
                    maxEarningsLifetime: 100000,
                    unlockDays: 14,
                    activeInvestmentRequired: true
                };
                await settings.save();
            }
            res.json(settings);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching settings' });
        }
    },

    updateSettings: async (req, res) => {
        try {
            const settings = await Settings.findOneAndUpdate({}, req.body, {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            });
            await logSecurityEvent({
                user: req.user.id,
                action: 'SETTINGS_UPDATE',
                details: `Platform settings updated`,
                status: 'info',
                req
            });
            res.json({ message: 'Settings updated successfully', settings });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error updating settings' });
        }
    },

    toggleSystemMaintenance: async (req, res) => {
        try {
            const settings = await Settings.findOne();
            if (settings) {
                settings.maintenanceMode = !settings.maintenanceMode;
                await settings.save();
                res.json({
                    message: `System ${settings.maintenanceMode ? 'frozen' : 'unfrozen'} successfully`,
                    maintenanceMode: settings.maintenanceMode
                });

                await logSecurityEvent({
                    user: req.user.id,
                    action: 'MAINTENANCE_TOGGLE',
                    details: `System ${settings.maintenanceMode ? 'FROZEN' : 'UNFROZEN'} by admin`,
                    status: settings.maintenanceMode ? 'warning' : 'success',
                    req
                });
            } else {
                res.status(404).json({ message: 'Settings not found' });
            }
        } catch (err) {
            res.status(500).json({ message: 'Error toggling maintenance' });
        }
    },

    getCurrentIp: async (req, res) => {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        res.json({ ip: clientIp });
    },

    addIpToWhitelist: async (req, res) => {
        try {
            const { ip } = req.body;
            if (!ip) return res.status(400).json({ message: 'IP is required' });

            const settings = await Settings.findOne();
            if (!settings.securityProtocols.ipWhitelist.includes(ip)) {
                settings.securityProtocols.ipWhitelist.push(ip);
                await settings.save();
            }

            await logSecurityEvent({
                user: req.user.id,
                action: 'SETTINGS_UPDATE',
                details: `Added ${ip} to security whitelist`,
                status: 'info',
                req
            });

            res.json({ message: 'IP added to whitelist', whitelist: settings.securityProtocols.ipWhitelist });
        } catch (err) {
            res.status(500).json({ message: 'Error adding IP' });
        }
    },

    removeIpFromWhitelist: async (req, res) => {
        try {
            const { ip } = req.body;
            const settings = await Settings.findOne();
            settings.securityProtocols.ipWhitelist = settings.securityProtocols.ipWhitelist.filter(i => i !== ip);
            await settings.save();

            await logSecurityEvent({
                user: req.user.id,
                action: 'SETTINGS_UPDATE',
                details: `Removed ${ip} from security whitelist`,
                status: 'info',
                req
            });

            res.json({ message: 'IP removed from whitelist', whitelist: settings.securityProtocols.ipWhitelist });
        } catch (err) {
            res.status(500).json({ message: 'Error removing IP' });
        }
    }
};

module.exports = settingsController;
