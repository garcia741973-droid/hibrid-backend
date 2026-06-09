const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController.cjs");
const requireAuth = require("../middlewares/requireAuth.cjs");

const {
  sendResetCode,
} = require(
  '../services/emailService'
);

router.post("/register", authController.register);
router.post("/login", authController.login);

// 🔔 RECORDATORIO
router.put("/reminder", requireAuth, authController.updateReminder);

router.get("/reminder", requireAuth, authController.getReminder);

// 🔐 CAMBIAR PASSWORD (🔥 NUEVO)
router.put("/change-password", requireAuth, authController.changePassword);

router.get(
  '/test-email',
  async (req, res) => {

    try {

      await sendResetCode(

        'garcia741973@gmail.com',

        '123456',
      );

      res.json({
        success: true,
      });

    } catch (e) {

      console.log(
        'EMAIL ERROR:',
        e,
      );

      res.status(500).json({

        error:
          e.message,
      });
    }
  }
);

module.exports = router;