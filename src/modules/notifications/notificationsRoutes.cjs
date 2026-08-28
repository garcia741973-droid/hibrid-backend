const express = require("express");

const router = express.Router();

const controller = require("./notificationsController.cjs");

const requireAuth = require("../../middlewares/requireAuth.cjs");
const requireRole = require("../../middlewares/requireRole.cjs");

// =============================
// 🔔 ENVIAR NOTIFICACIÓN
// SOLO ADMIN / SUPERADMIN
// =============================
router.post(
  "/send",
  requireAuth,
  requireRole(["admin", "superadmin"]),
  controller.sendNotification
);

module.exports = router;