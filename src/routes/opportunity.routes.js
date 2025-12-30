const express = require('express');
const router = express.Router();
const userInvestmentController = require('../controllers/user/user.investment.controller');

router.get('/', userInvestmentController.getOpportunities);

module.exports = router;
