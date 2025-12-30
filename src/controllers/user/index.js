const profileController = require('./user.profile.controller');
const financeController = require('./user.finance.controller');
const investmentController = require('./user.investment.controller');
const notificationController = require('./user.notification.controller');

const userController = {
    ...profileController,
    ...financeController,
    ...investmentController,
    ...notificationController
};

module.exports = userController;
