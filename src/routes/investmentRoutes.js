const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

const {
    createPlan,
    getPlans,
    invest,
    getMyInvestments,
    getAllInvestments
} = require('../controllers/investmentController');

router.post('/plans', protect, authorize('admin'), createPlan);
router.get('/plans', getPlans);
router.post('/invest', protect, invest);
router.get('/my', protect, getMyInvestments);
router.get('/all', protect, authorize('admin'), getAllInvestments);

module.exports = router;
