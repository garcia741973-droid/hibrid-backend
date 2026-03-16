const express = require('express');
const router = express.Router();

const controller = require('../controllers/clientController.cjs');
const requireAuth = require('../middlewares/requireAuth.cjs');

router.get('/plans', requireAuth, controller.getPlans);
router.get('/payment-qr', requireAuth, controller.getPaymentQr);
router.post('/request-membership', requireAuth, controller.requestMembership);

module.exports = router;