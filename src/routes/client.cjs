const express = require('express');
const router = express.Router();

const controller = require('../controllers/clientController.cjs');
const requireAuth = require('../middlewares/requireAuth.cjs');


router.get('/plans', requireAuth, controller.getPlans);
router.get('/payment-qr', requireAuth, controller.getPaymentQr);
router.post(
  '/request-membership',
  requireAuth,
  controller.requestMembership
);
router.get('/me', requireAuth, controller.getMe);
router.get('/my-membership', requireAuth, controller.getMyMembership);

// NUEVA RUTA
router.get('/clients', requireAuth, controller.getClients);

router.get(
  '/membership-history',
  requireAuth,
  controller.getMembershipHistory
);

router.get('/my-qr', requireAuth, controller.getMyQr);


const jwt = require("jsonwebtoken");

exports.getMyQr = async (req, res) => {
  try {

    const userId = req.user.id;

    /// 🔥 TOKEN DE 5 MINUTOS
    const token = jwt.sign(
      { user_id: userId },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    res.json({
      qr: token
    });

  } catch (err) {

    res.status(500).json({
      error: "Error generando QR"
    });

  }
};

module.exports = router;