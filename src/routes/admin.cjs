const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController.cjs");

const requireAuth = require("../middlewares/requireAuth.cjs");
const requireRole = require("../middlewares/requireRole.cjs");

router.post(
 "/create-client",
 adminController.createClient
);

module.exports = router;