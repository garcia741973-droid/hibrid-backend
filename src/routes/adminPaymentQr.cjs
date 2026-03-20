const express = require('express');
const router = express.Router();

const controller = require('../controllers/adminPaymentQrController.cjs');
const requireAuth = require('../middlewares/requireAuth.cjs');
const requireRole = require('../middlewares/requireRole.cjs');

/// ADMIN
router.post('/payment-qrs',
  requireAuth,
  requireRole(["admin","superadmin"]),
  controller.createQr
);

router.get('/payment-qrs',
  requireAuth,
  requireRole(["admin","superadmin"]),
  controller.getQrs
);

router.patch('/payment-qrs/:id/activate',
  requireAuth,
  requireRole(["admin","superadmin"]),
  controller.activateQr
);

/// CLIENT / STAFF
router.get('/payment-qr-active',
  requireAuth,
  controller.getActiveQr
);

router.get('/payment-qrs/expiring',
  requireAuth,
  requireRole(["admin","superadmin"]),
  controller.checkQrExpiring
);

module.exports = router;