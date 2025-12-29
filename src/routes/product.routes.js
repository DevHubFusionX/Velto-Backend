const express = require('express');
const router = express.Router();
const investmentController = require('../controllers/investment.controller');

router.get('/', investmentController.getProducts);

module.exports = router;
