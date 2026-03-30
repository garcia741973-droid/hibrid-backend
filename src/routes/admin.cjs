const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");

const adminController = require("../controllers/adminController.cjs");

const requireAuth = require("../middlewares/requireAuth.cjs");
const requireRole = require("../middlewares/requireRole.cjs");

router.post(
 "/create-client",
 requireAuth,
 requireRole(["admin","superadmin"]),
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

router.get(
  "/admins",
  requireAuth,
  async (req, res) => {
    try {

      const { rows } = await pool.query(`
        SELECT id, name, email
        FROM users
        WHERE role IN ('admin', 'superadmin')
      `);

      res.json(rows);

    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

module.exports = router;