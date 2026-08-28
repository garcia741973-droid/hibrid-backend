const express = require('express');
const router = express.Router();

const controller = require('../controllers/clientController.cjs');
const requireAuth = require('../middlewares/requireAuth.cjs');
const requireRole = require('../middlewares/requireRole.cjs');

router.get('/plans', requireAuth, controller.getPlans);
router.get('/payment-qr', requireAuth, controller.getPaymentQr);
router.post(
  '/request-membership',
  requireAuth,
  controller.requestMembership
);
router.get('/me', requireAuth, controller.getMe);
router.get('/my-membership', requireAuth, controller.getMyMembership);

// =============================
// 👥 LISTADO DE CLIENTES
// Solo personal autorizado
// =============================
router.get(
  '/clients',
  requireAuth,
  requireRole(['staff', 'admin', 'superadmin']),
  controller.getClients
);

router.get(
  '/membership-history',
  requireAuth,
  controller.getMembershipHistory
);

router.get('/my-qr', requireAuth, controller.getMyQr);

module.exports = router;