const express = require('express');
const router = express.Router();

const requireAuth = require('../../middlewares/requireAuth.cjs');

// 🔥 IMPORT CORRECTO
const controller = require('./trainerPackagesController.cjs');

router.post('/', requireAuth, controller.createPackage);
router.get('/', requireAuth, controller.getPackages);

router.post('/assign', requireAuth, controller.assignPackage);
router.get('/client/:id', requireAuth, controller.getClientPackages);

module.exports = router;