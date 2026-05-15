const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const userSchemas = require('../validations/user.schema');
const Joi = require('joi');

const withdrawInvestmentSchema = Joi.object({
    investmentId: Joi.string().hex().length(24).required()
});

router.use(auth.protect);

router.get('/profile', userController.getProfile);
router.put('/profile', validateRequest(userSchemas.updateProfile), userController.updateProfile);
router.get('/dashboard', userController.getDashboard);
router.get('/notifications', userController.getNotifications);
router.put('/notifications/:id/read', userController.markNotificationRead);
router.get('/transactions', userController.getTransactions);
router.post('/invest', validateRequest(userSchemas.invest), userController.invest);
router.post('/investments/:investmentId/withdraw', validateRequest(withdrawInvestmentSchema, 'params'), userController.withdrawInvestment);
router.get('/investments/payouts/history', userController.getPayoutHistory);
router.get('/settings', userController.getSettings);

// Crypto Routes
router.get('/crypto/wallets', userController.getMyWallets);
router.get('/crypto/deposit-addresses', userController.getDepositAddresses);
router.post('/crypto/deposit', userController.initiateCryptoDeposit);
router.post('/crypto/deposit/:transactionId/proof', userController.submitCryptoProof);
router.post('/crypto/withdraw', userController.requestCryptoWithdrawal);

module.exports = router;
