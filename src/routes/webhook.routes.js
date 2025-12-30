const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

// NOWPayments IPN Webhook
router.post('/nowpayments', webhookController.handleNOWPaymentsIPN);

module.exports = router;
