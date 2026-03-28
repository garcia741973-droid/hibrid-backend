const express = require('express');
const router = express.Router();

const requireAuth = require('../../middlewares/requireAuth.cjs');
const controller = require('./trainerController.cjs');

router.post('/sessions', requireAuth, controller.createSession);
router.get('/sessions', requireAuth, controller.getSessions);
router.put('/sessions/:id/status', requireAuth, controller.updateSessionStatus);

module.exports = router;