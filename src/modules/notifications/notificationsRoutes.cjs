const express = require("express");
const router = express.Router();

const controller = require("./notificationsController.cjs");

router.post("/send", controller.sendNotification);

module.exports = router;