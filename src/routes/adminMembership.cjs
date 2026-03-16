const express = require('express');
const router = express.Router();

const controller = require('../controllers/adminMembershipController');

const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

router.get('/membership-requests',
requireAuth,
requireRole(["admin","superadmin"]),
controller.getRequests);

router.post('/approve-membership/:id',
requireAuth,
requireRole(["admin","superadmin"]),
controller.approveMembership);

module.exports = router;