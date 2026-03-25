const { pool } = require('../../config/db');


// CREAR EMPRESA
  exports.createCompany = async (req, res) => {
    try {

      const {
        name,
        type,
        plan_id,
        expiration_date,
        contact_name,
        contact_phone,
        contact_email,
        city,
        country
      } = req.body;

      if (!name || !type || !plan_id || !expiration_date) {
        return res.status(400).json({
          error: "Faltan datos obligatorios"
        });
      }

      const { rows } = await pool.query(
        `
        INSERT INTO companies 
        (
          name,
          type,
          plan_id,
          subscription_status,
          expiration_date,
          contact_name,
          contact_phone,
          contact_email,
          city,
          country
        )
        VALUES ($1,$2,$3,'active',$4,$5,$6,$7,$8,$9)
        RETURNING *
        `,
        [
          name,
          type,
          plan_id,
          expiration_date,
          contact_name || '',
          contact_phone || '',
          contact_email || '',
          city || '',
          country || ''
        ]
      );

      res.json(rows[0]);

    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Error creando empresa"
      });
    }
  };


// LISTAR EMPRESAS
  exports.getCompanies = async (req, res) => {
    try {

      const { rows } = await pool.query(
        `
        SELECT 
          c.id,
          c.name,
          c.type,
          c.subscription_status,
          c.expiration_date,
          c.plan_id,
          p.name AS plan_name
        FROM companies c
        LEFT JOIN company_plans p ON c.plan_id = p.id
        ORDER BY c.created_at DESC
        `
      );

      res.json(rows);

    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Error obteniendo empresas"
      });
    }
  };

const bcrypt = require('bcrypt');

// CREAR ADMIN POR EMPRESA
exports.createAdmin = async (req, res) => {
  try {

    const { name, email, password, company_id } = req.body;

    if (!name || !email || !password || !company_id) {
      return res.status(400).json({
        error: "Faltan datos"
      });
    }

    // verificar empresa existe
    const company = await pool.query(
      `SELECT id FROM companies WHERE id = $1`,
      [company_id]
    );

    if (company.rows.length === 0) {
      return res.status(400).json({
        error: "Empresa no existe"
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `
      INSERT INTO users (name, email, password, role, company_id)
      VALUES ($1,$2,$3,'admin',$4)
      RETURNING id,name,email,role,company_id
      `,
      [name, email, hashedPassword, company_id]
    );

    res.json(rows[0]);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error creando admin"
    });

  }
};