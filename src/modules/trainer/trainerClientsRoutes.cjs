const express = require('express');
const router = express.Router();

const requireAuth = require('../../middlewares/requireAuth.cjs');
const controller = require('./trainerClients.cjs');

router.post('/clients', requireAuth, controller.createClient);
router.get('/clients', requireAuth, controller.getClients);

module.exports = router;