const express = require('express');
const router = express.Router();

const controller = require('./superadminController.cjs');

const requireAuth = require('../../middlewares/requireAuth.cjs');
const requireRole = require('../../middlewares/requireRole.cjs');

router.post(
  '/companies',
  requireAuth,
  requireRole(['superadmin']),
  controller.createCompany
);

router.get(
  '/companies',
  requireAuth,
  requireRole(['superadmin']),
  controller.getCompanies
);

router.post(
  '/create-admin',
  requireAuth,
  requireRole(['superadmin']),
  controller.createAdmin
);

module.exports = router;