const statsController = require('./admin.stats.controller');
const userController = require('./admin.user.controller');
const transactionController = require('./admin.transaction.controller');
const investmentController = require('./admin.investment.controller');
const settingsController = require('./admin.settings.controller');
const kycController = require('./admin.kyc.controller');
const notificationController = require('./admin.notification.controller');

const adminController = {
    ...statsController,
    ...userController,
    ...transactionController,
    ...investmentController,
    ...settingsController,
    ...kycController,
    ...notificationController
};

module.exports = adminController;
