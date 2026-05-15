const express = require('express');
const router = express.Router();
const userInvestmentController = require('../controllers/user/user.investment.controller');
const adminInvestmentController = require('../controllers/admin/admin.investment.controller');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const Joi = require('joi');

const investSchema = Joi.object({
    planId: Joi.string().hex().length(24),
    productId: Joi.string().hex().length(24),
    amount: Joi.number().positive().max(10000000).required(),
    currency: Joi.string().valid('USD').default('USD')
}).or('planId', 'productId');

// Private routes
router.use(auth.protect);

// User Routes
router.get('/', userInvestmentController.getMyInvestments);
router.post('/invest', validateRequest(investSchema), userInvestmentController.invest);
router.get('/plans/list', userInvestmentController.getPlans);

// Admin Routes
router.post('/plans', auth.authorize('admin'), adminInvestmentController.createInvestmentPlan);
router.put('/plans/:id', auth.authorize('admin'), adminInvestmentController.updatePlan);
router.delete('/plans/:id', auth.authorize('admin'), adminInvestmentController.deletePlan);
router.patch('/plans/:id/status', auth.authorize('admin'), adminInvestmentController.togglePlanStatus);
router.get('/plans/admin/list', auth.authorize('admin'), adminInvestmentController.getAllPlans);
router.get('/admin/all', auth.authorize('admin'), adminInvestmentController.getAllInvestments);

module.exports = router;
