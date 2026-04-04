const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController.cjs");
const requireAuth = require("../middlewares/requireAuth.cjs");

router.post("/register", authController.register);
router.post("/login", authController.login);

// 🔔 RECORDATORIO
router.put("/reminder", requireAuth, authController.updateReminder);

module.exports = router;