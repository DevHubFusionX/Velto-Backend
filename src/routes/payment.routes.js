const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
