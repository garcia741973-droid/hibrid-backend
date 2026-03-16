const express = require('express');
const router = express.Router();

const controller = require('../controller/clientController');
const requireAuth = require('../middleware/requireAuth');

router.get('/plans', requireAuth, controller.getPlans);
router.get('/payment-qr', requireAuth, controller.getPaymentQr);

router.post('/request-membership', requireAuth, controller.requestMembership);

module.exports = router;