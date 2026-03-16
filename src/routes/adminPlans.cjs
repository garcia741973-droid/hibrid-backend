const express = require('express');
const router = express.Router();

const controller = require('../controllers/adminPlansController');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

router.post('/create-plan',
requireAuth,
requireRole(["admin","superadmin"]),
controller.createPlan);

router.get('/plans',
requireAuth,
requireRole(["admin","superadmin"]),
controller.getPlans);

module.exports = router;
