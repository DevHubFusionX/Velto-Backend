const express = require('express');
const router = express.Router();
const userInvestmentController = require('../controllers/user/user.investment.controller');
const adminInvestmentController = require('../controllers/admin/admin.investment.controller');
const auth = require('../middleware/auth');

// Private routes
router.use(auth.protect);

// User Routes
router.get('/', userInvestmentController.getMyInvestments);
router.get('/my/investments', userInvestmentController.getMyInvestments);
router.post('/invest', userInvestmentController.invest);
router.get('/plans/list', userInvestmentController.getPlans);

// Admin Routes
router.post('/plans', auth.authorize('admin'), adminInvestmentController.createInvestmentPlan);
router.put('/plans/:id', auth.authorize('admin'), adminInvestmentController.updatePlan);
router.delete('/plans/:id', auth.authorize('admin'), adminInvestmentController.deletePlan);
router.patch('/plans/:id/status', auth.authorize('admin'), adminInvestmentController.togglePlanStatus);
router.get('/plans/admin/list', auth.authorize('admin'), adminInvestmentController.getAllPlans);
router.get('/admin/all', auth.authorize('admin'), adminInvestmentController.getAllInvestments);

module.exports = router;
