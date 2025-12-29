const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const validateRequest = require('../middleware/validateRequest');
const adminSchemas = require('../validations/admin.schema');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes in this file
router.use(protect);
router.use(authorize('admin', 'Superuser'));

// Admin Dashboard & Health
router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.get('/products', adminController.getProductsWithStats);
router.get('/health', adminController.getSystemHealth);
router.get('/logs', adminController.getLogs);
router.get('/withdrawals', adminController.getWithdrawals);
router.get('/kyc/pending', adminController.getPendingKYC);
router.post('/kyc/:kycId/approve', adminController.approveKYC);
router.post('/kyc/:kycId/reject', adminController.rejectKYC);
router.post('/system/toggle-freeze', adminController.toggleSystemMaintenance);
router.post('/plans/create', validateRequest(adminSchemas.createPlan), adminController.createInvestmentPlan);

// User Management Routes
router.get('/users/:userId/details', adminController.getUserDetails);
router.post('/users/:userId/balance', adminController.updateUserBalance);
router.post('/users/:userId/suspend', adminController.suspendUser);
router.post('/users/:userId/activate', adminController.activateUser);
router.delete('/users/:userId', adminController.deleteUser);

// Investment Analytics and Payouts
router.get('/analytics/investments', adminController.getInvestmentAnalytics);
router.post('/payouts/trigger', adminController.triggerPayouts);
router.get('/payouts/logs', adminController.getPayoutLogs);

// Withdrawal Management
router.post('/withdrawals/:transactionId/release', adminController.approveWithdrawal);
router.post('/withdrawals/:transactionId/reject', validateRequest(adminSchemas.rejectWithdrawal), adminController.rejectWithdrawal);

// Deposit Management
router.get('/deposits', adminController.getDeposits);
router.post('/deposits/:transactionId/approve', adminController.approveDeposit);
router.post('/deposits/:transactionId/reject', adminController.rejectDeposit);

// Platform Settings & Security
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);
router.post('/settings/whitelist/add', adminController.addIpToWhitelist);
router.post('/settings/whitelist/remove', adminController.removeIpFromWhitelist);
router.get('/security/my-ip', adminController.getCurrentIp);
router.post('/users/:userId/revoke-session', adminController.revokeSession);

module.exports = router;
