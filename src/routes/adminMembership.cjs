const express = require('express');
const router = express.Router();

const controller = require('../controllers/adminMembershipController.cjs');
const requireAuth = require('../middlewares/requireAuth.cjs');
const requireRole = require('../middlewares/requireRole.cjs');

router.get('/membership-requests',
requireAuth,
requireRole(["admin","superadmin"]),
controller.getRequests);

router.post('/approve-membership/:id',
requireAuth,
requireRole(["admin","superadmin"]),
controller.approveMembership);

router.post(
'/validate-qr',
requireAuth,
requireRole(["admin","superadmin"]),
controller.validateQr
);

module.exports = router;