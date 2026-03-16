const express = require('express');
const router = express.Router();

const controller = require('../controllers/adminPlansController.cjs');
const requireAuth = require('../middlewares/requireAuth.cjs');
const requireRole = require('../middlewares/requireRole.cjs');

router.post('/create-plan',
requireAuth,
requireRole(["admin","superadmin"]),
controller.createPlan);

router.get('/plans',
requireAuth,
requireRole(["admin","superadmin"]),
controller.getPlans);

module.exports = router;
