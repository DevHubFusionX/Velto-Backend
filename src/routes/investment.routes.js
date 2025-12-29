const express = require('express');
const router = express.Router();
const investmentController = require('../controllers/investment.controller');
const auth = require('../middleware/auth');

// Private routes
router.use(auth.protect); // Ensure protect middleware is used properly from export

// Legacy Routes
router.get('/', investmentController.getAll);
router.get('/:id', investmentController.getById);

// New System Routes
router.post('/plans', auth.authorize('admin'), investmentController.createPlan);
router.put('/plans/:id', auth.authorize('admin'), investmentController.updatePlan);
router.delete('/plans/:id', auth.authorize('admin'), investmentController.deletePlan);
router.patch('/plans/:id/status', auth.authorize('admin'), investmentController.togglePlanStatus);
router.get('/plans/list', investmentController.getPlans); // Public: Active only
router.get('/plans/admin/list', auth.authorize('admin'), investmentController.getAllPlans); // Admin: All plans
router.post('/invest', investmentController.invest);
router.get('/my/investments', investmentController.getMyInvestments);
router.get('/admin/all', auth.authorize('admin'), investmentController.getAllInvestments);

module.exports = router;
