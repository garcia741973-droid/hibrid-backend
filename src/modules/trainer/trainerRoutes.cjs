const express = require('express');
const router = express.Router();

const requireAuth = require('../../middlewares/requireAuth.cjs');
const controller = require('./trainerController.cjs');

const packagesController = require('./trainerPackagesController.cjs');

router.post('/sessions', requireAuth, controller.createSession);
router.get('/sessions', requireAuth, controller.getSessions);
router.put('/sessions/:id/status', requireAuth, controller.updateSessionStatus);

router.post('/package-requests', requireAuth, controller.createPackageRequest);
router.get('/package-requests', requireAuth, controller.getPackageRequests);
router.post('/package-requests/:id/approve', requireAuth, controller.approveTrainerPackage);

router.post('/packages', requireAuth, packagesController.createPackage);
router.get('/packages', requireAuth, packagesController.getPackages);

module.exports = router;