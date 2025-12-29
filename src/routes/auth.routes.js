const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const authSchemas = require('../validations/auth.schema');

router.post('/login', validateRequest(authSchemas.login), authController.login);
router.post('/register', validateRequest(authSchemas.register), authController.register);
router.post('/verify-email', validateRequest(authSchemas.verifyEmail), authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', validateRequest(authSchemas.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validateRequest(authSchemas.resetPassword), authController.resetPassword);
router.get('/me', auth.protect, authController.getMe);

// 2FA Routes
router.post('/2fa/setup', auth.protect, authController.setup2FA);
router.post('/2fa/verify-setup', auth.protect, authController.verify2FASetup);
router.post('/2fa/disable', auth.protect, authController.disable2FA);
router.post('/2fa/verify-login', authController.verify2FALogin);

module.exports = router;
