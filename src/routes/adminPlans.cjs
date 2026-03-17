const express = require('express');
const router = express.Router();

const controller = require('../controllers/adminPlansController.cjs');
const requireAuth = require('../middlewares/requireAuth.cjs');
const requireRole = require('../middlewares/requireRole.cjs');


// =============================
// CREAR PLAN (YA EXISTÍA)
// =============================
router.post(
  '/create-plan',
  requireAuth,
  requireRole(["admin","superadmin"]),
  controller.createPlan
);


// =============================
// OBTENER TODOS LOS PLANES (ADMIN)
// 🔥 CAMBIAMOS getPlans → getAllPlans
// =============================
router.get(
  '/plans',
  requireAuth,
  requireRole(["admin","superadmin"]),
  controller.getAllPlans
);


// =============================
// ACTIVAR / DESACTIVAR PLAN
// =============================
router.patch(
  '/plans/:id/toggle',
  requireAuth,
  requireRole(["admin","superadmin"]),
  controller.togglePlan
);

router.put('/plans/:id',
requireAuth,
requireRole(["admin","superadmin"]),
controller.updatePlan);

module.exports = router;