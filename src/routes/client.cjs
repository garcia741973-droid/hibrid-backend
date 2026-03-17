const express = require('express');
const router = express.Router();

const controller = require('../controllers/clientController.cjs');
const requireAuth = require('../middlewares/requireAuth.cjs');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.get('/plans', requireAuth, controller.getPlans);
router.get('/payment-qr', requireAuth, controller.getPaymentQr);
router.post(
  '/request-membership',
  requireAuth,
  upload.single('payment_proof'),   // 🔥 ESTE ES EL FIX
  controller.requestMembership
);
router.get('/me', requireAuth, controller.getMe);
router.get('/my-membership', requireAuth, controller.getMyMembership);

// NUEVA RUTA
router.get('/clients', requireAuth, controller.getClients);

module.exports = router;