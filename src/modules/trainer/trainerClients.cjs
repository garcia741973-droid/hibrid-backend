const { pool } = require('../../config/db');

const { pool } = require('../../config/db');
const bcrypt = require('bcrypt');

// ✅ CREAR CLIENTE COMPLETO
const createClient = async (req, res) => {
  try {
    const {
      name,
      last_name,
      email,
      phone,
      gender,
      birth_date,
      emergency_contact_name,
      emergency_contact_phone,
      photo_url
    } = req.body;

    const company_id = req.user.company_id;

    const password = "123456";
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (
        name,
        last_name,
        email,
        password,
        role,
        phone,
        gender,
        birth_date,
        emergency_contact_name,
        emergency_contact_phone,
        photo_url,
        company_id
      )
      VALUES ($1,$2,$3,$11,'client',$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, name, last_name, email, phone, photo_url
      `,
      [
        name,
        last_name,
        email || `${Date.now()}@temp.com`,
        phone,
        gender,
        birth_date,
        emergency_contact_name,
        emergency_contact_phone,
        photo_url,
        company_id,
        hashedPassword
      ]
    );

    res.json({
      user: result.rows[0],
      password: password // 🔥 IMPORTANTE
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error creando cliente" });
  }
};

// ✅ LISTAR CLIENTES COMPLETO
const getClients = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const result = await pool.query(
      `
      SELECT 
        id,
        name,
        last_name,
        email,
        phone,
        gender,
        birth_date,
        photo_url
      FROM users
      WHERE role = 'client'
      AND company_id = $1
      ORDER BY id DESC
      `,
      [company_id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo clientes" });
  }
};

module.exports = {
  createClient,
  getClients,
};