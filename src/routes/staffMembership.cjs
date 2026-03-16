const express = require('express');
const router = express.Router();

const controller = require('../controllers/staffMembershipController.cjs');

const requireAuth = require('../middlewares/requireAuth.cjs');
const requireRole = require('../middlewares/requireRole.cjs');

router.post(
  '/create-membership',
  requireAuth,
  requireRole(["staff","admin","superadmin"]),
  controller.createMembership
);

module.exports = router;