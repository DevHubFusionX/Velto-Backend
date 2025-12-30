const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const userSchemas = require('../validations/user.schema');

router.use(auth.protect); // All user routes require authentication

router.get('/profile', userController.getProfile);
router.put('/profile', validateRequest(userSchemas.updateProfile), userController.updateProfile);
router.get('/dashboard', userController.getDashboard);
router.get('/notifications', userController.getNotifications);
router.put('/notifications/:id/read', userController.markNotificationRead);
router.post('/deposit', validateRequest(userSchemas.deposit), userController.deposit);
router.post('/withdraw', validateRequest(userSchemas.withdraw), userController.withdraw);
router.get('/transactions', userController.getTransactions);
router.post('/invest', validateRequest(userSchemas.invest), userController.invest);
router.post('/investments/:investmentId/withdraw', userController.withdrawInvestment);
router.get('/investments/payouts/history', userController.getPayoutHistory);
router.get('/settings', userController.getSettings);

module.exports = router;
