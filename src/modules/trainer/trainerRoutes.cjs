const express = require('express');
const router = express.Router();

const requireAuth = require('../../middlewares/requireAuth.cjs');
const controller = require('./trainerController.cjs');


router.post('/sessions', requireAuth, controller.createSession);
router.get('/sessions', requireAuth, controller.getSessions);
router.put('/sessions/:id/status', requireAuth, controller.updateSessionStatus);

router.post('/package-requests', requireAuth, controller.createPackageRequest);
router.get('/package-requests', requireAuth, controller.getPackageRequests);
router.post('/package-requests/:id/approve', requireAuth, controller.approveTrainerPackage);

router.get(
  "/client-package/:clientId",
  requireAuth,
  controller.getClientPackage
);

router.post(
  "/sessions/auto",
  requireAuth,
  controller.autoCreateSessions
);

router.get('/clients', requireAuth, controller.getClients);

module.exports = router;