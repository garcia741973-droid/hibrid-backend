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