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

router.get(
  '/plans',
  requireAuth,
  requireRole(['superadmin']),
  controller.getPlans
);

router.post(
  '/plans',
  requireAuth,
  requireRole(['superadmin']),
  controller.createPlan
);

router.get(
  '/company/status',
  requireAuth,
  controller.getCompanyStatus
);

router.post(
  '/activate-plan',
  requireAuth,
  requireRole(['superadmin']),
  controller.activateCompanyPlan
);

router.put(
  '/companies/:id',
  requireAuth,
  requireRole(['superadmin']),
  controller.updateCompany
);

module.exports = router;