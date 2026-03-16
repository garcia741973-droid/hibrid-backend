const express = require('express');
const router = express.Router();

const { createMembershipRequest } = require('../controllers/membershipController.cjs');

const requireAuth = require('../middlewares/requireAuth.cjs');

router.post('/membership-request', requireAuth, createMembershipRequest);

module.exports = router;