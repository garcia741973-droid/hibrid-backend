const { pool } = require('../../config/db');


// CREAR EMPRESA
exports.createCompany = async (req, res) => {
  try {

    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "Nombre requerido"
      });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO companies (name)
      VALUES ($1)
      RETURNING *
      `,
      [name]
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
      SELECT id, name, is_active, created_at
      FROM companies
      ORDER BY created_at DESC
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