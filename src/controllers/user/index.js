const profileController = require('./user.profile.controller');
const financeController = require('./user.finance.controller');
const investmentController = require('./user.investment.controller');
const notificationController = require('./user.notification.controller');
const cryptoController = require('./user.crypto.controller');

const userController = {
    ...profileController,
    ...financeController,
    ...investmentController,
    ...notificationController,
    ...cryptoController
};

module.exports = userController;
