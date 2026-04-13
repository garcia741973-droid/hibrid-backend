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
 requireAuth,
 requireRole(["admin","superadmin"]),
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

    const { rows } = await pool.query(
      `
      SELECT id, name, email
      FROM users
      WHERE role IN ('admin', 'superadmin')
      AND company_id = $1
      `,
      [req.user.company_id]
    );

      res.json(rows);

    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

// =============================
// 🔥 SUPPORT (CHAT)
// =============================
router.get(
  "/support",
  requireAuth, // 🔥 SOLO autenticado (cliente incluido)
  async (req, res) => {

    try {

      const { rows } = await pool.query(
        `
        SELECT id, name, role
        FROM users
        WHERE role IN ('admin','staff')
        AND company_id = $1
        AND is_active = true
        ORDER BY role DESC
        `,
        [req.user.company_id]
      );

      res.json(rows);

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: "Error obteniendo soporte"
      });

    }

  }
);

// =============================
// 🔥 STAFF
// =============================

// CREAR STAFF
router.post(
  "/create-staff",
  requireAuth,
  requireRole(["admin","superadmin"]),
  async (req, res) => {

    try {

      const { name, last_name, email, password, phone } = req.body;

      if (req.user.company_type !== "gym") {
        return res.status(403).json({
          error: "Solo gimnasios pueden crear staff"
        });
      }

      if (!name || !email || !password) {
        return res.status(400).json({
          error: "Faltan datos obligatorios"
        });
      }

      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash(password, 10);

      const { rows } = await pool.query(
        `
        INSERT INTO users
        (name,last_name,email,password,phone,role,company_id,created_at)
        VALUES ($1,$2,$3,$4,$5,'staff',$6,NOW())
        RETURNING id,name,email,role
        `,
        [
          name,
          last_name || "",
          email,
          hashedPassword,
          phone || "",
          req.user.company_id
        ]
      );

      res.json({
        message: "Staff creado",
        staff: rows[0]
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Error creando staff"
      });

    }

  }
);

// LISTAR STAFF
router.get(
  "/staff",
  requireAuth,
  requireRole(["admin","superadmin"]),
  async (req, res) => {

    try {

      const { rows } = await pool.query(
        `
        SELECT id, name, last_name, email, phone
        FROM users
        WHERE role = 'staff'
        AND company_id = $1
        AND is_active = true
        ORDER BY created_at DESC
        `,
        [req.user.company_id]
      );

      res.json(rows);

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: "Error obteniendo staff"
      });

    }

  }
);

// ACTUALIZAR STAFF
router.put(
  "/update-staff/:id",
  requireAuth,
  requireRole(["admin","superadmin"]),
  async (req, res) => {

    try {

      const { id } = req.params;
      const { name, last_name, phone, password } = req.body;

      let hashedPassword = null;

      if (password && password.length > 0) {
        const bcrypt = require("bcryptjs");
        hashedPassword = await bcrypt.hash(password, 10);
      }

      let query;
      let values;

      if (hashedPassword) {

        query = `
          UPDATE users
          SET name=$1, last_name=$2, phone=$3, password=$4
          WHERE id=$5 AND company_id=$6
          RETURNING id,name,email
        `;

        values = [
          name,
          last_name,
          phone,
          hashedPassword,
          id,
          req.user.company_id
        ];

      } else {

        query = `
          UPDATE users
          SET name=$1, last_name=$2, phone=$3
          WHERE id=$4 AND company_id=$5
          RETURNING id,name,email
        `;

        values = [
          name,
          last_name,
          phone,
          id,
          req.user.company_id
        ];
      }

      const { rows } = await pool.query(query, values);

      res.json({
        message: "Staff actualizado",
        staff: rows[0]
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: "Error actualizando staff"
      });

    }

  }
);

// =============================
// 🔥 ELIMINAR STAFF
// =============================
router.delete(
  "/delete-staff/:id",
  requireAuth,
  requireRole(["admin","superadmin"]),
  async (req, res) => {

    try {

      const { id } = req.params;

      const { rows } = await pool.query(
        `
        UPDATE users
        SET is_active = false
        WHERE id = $1
        AND company_id = $2
        RETURNING id
        `,
        [id, req.user.company_id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: "Staff no encontrado"
        });
      }

      res.json({
        message: "Staff eliminado"
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: "Error eliminando staff"
      });

    }

  }
);

module.exports = router;