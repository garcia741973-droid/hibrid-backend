const express = require('express');
const router = express.Router();

const controller = require('../modules/trainer/trainerSessions.cjs');
const requireAuth = require('../middlewares/requireAuth.cjs');

router.post('/create', requireAuth, controller.createSessions);
router.get('/:user_id', requireAuth, controller.getClientSessions);
router.post('/use', requireAuth, controller.useSession);

module.exports = router;