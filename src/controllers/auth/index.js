const loginController = require('./auth.login.controller');
const registerController = require('./auth.register.controller');
const passwordController = require('./auth.password.controller');
const twoFactorController = require('./auth.2fa.controller');

const authController = {
    ...loginController,
    ...registerController,
    ...passwordController,
    ...twoFactorController
};

module.exports = authController;
