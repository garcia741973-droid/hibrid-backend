const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController.cjs");

const requireAuth = require("../middlewares/requireAuth.cjs");
const requireRole = require("../middlewares/requireRole.cjs");

router.post(
 "/create-client",
 adminController.createClient
);

router.get(
 "/clients",
 adminController.getClients
);

router.put(
 "/update-client/:id",
 requireAuth,
 requireRole(["admin","superadmin"]),
 adminController.updateClient
);

module.exports = router;